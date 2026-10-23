package co.ehealth.platform.pharmacy.csvimport;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.pharmacy.stock.PharmacyBatch;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.StockBaseUnit;
import co.ehealth.platform.pharmacy.stock.StockCategory;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.SupplierDuplicateDetector;
import co.ehealth.platform.pharmacy.supplier.SupplierNameKey;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

// Decides, row by row, what an import would do and explains every problem in
// plain language. Pure logic over data the caller already loaded, so the same
// verdicts back both the preview (check) and the real import (run).
@Component
public class ImportRowChecker {

    static final String NO_LOT = "N/A";
    private static final int MIN_SIMILAR_LENGTH = 5;
    private static final int MAX_TYPO_DISTANCE = 2;
    private static final DateTimeFormatter DAY_FIRST = DateTimeFormatter.ofPattern("d/M/uuuu");
    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final SupplierDuplicateDetector supplierDetector;

    public ImportRowChecker(SupplierDuplicateDetector supplierDetector) {
        this.supplierDetector = supplierDetector;
    }

    public interface LotLookup {
        Optional<PharmacyBatch> find(UUID productId, String lot);
    }

    public interface InvoiceLookup {
        boolean alreadyReceived(UUID supplierId, String invoiceNumber);
    }

    // Everything the checker needs to know about the pharmacy's current state.
    public record Context(Map<String, PharmacyProduct> productsByKey, Collection<PharmacyProduct> catalogue,
                          Collection<PharmacySupplier> suppliers, PharmacySupplier fileSupplier,
                          String fileInvoice, LocalDate today, LotLookup lots, InvoiceLookup invoices) {
    }

    // The product a "new product" row would create, taken from its first row.
    public record NewProductSpec(String code, String name, StockCategory category, StockBaseUnit unit,
                                 Integer packSize, DrugSchedule schedule, boolean batchTracked,
                                 boolean expiryTracked) {
    }

    public record CheckedRow(int rowNumber, ImportRowStatus status, ImportProblem problem, String hint,
                             String suggestion, String warning, PharmacyProduct product, NewProductSpec newProduct,
                             String lot, LocalDate expiry, int quantity, PharmacySupplier supplier, String invoice,
                             boolean scheduled) {

        public boolean isProblem() {
            return status == ImportRowStatus.PROBLEM;
        }
    }

    public static String productKey(String sku) {
        return sku == null ? "" : sku.trim().toUpperCase(Locale.ROOT);
    }

    public List<CheckedRow> check(List<ImportRow> rows, Context context) {
        Set<String> lotsSeen = new HashSet<>();
        Map<String, NewProductSpec> newProductsSoFar = new HashMap<>();
        List<CheckedRow> checked = new ArrayList<>();
        for (int index = 0; index < rows.size(); index++) {
            checked.add(checkRow(index + 1, rows.get(index), context, lotsSeen, newProductsSoFar));
        }
        return checked;
    }

    // What the row needs to know about its product, whether the product exists
    // or is about to be created by an earlier row of the same file.
    private record Traits(boolean batchTracked, boolean expiryTracked, String displayName, DrugSchedule schedule) {
    }

    // Either the product a row would create or the problem that stops it.
    private record SpecOutcome(NewProductSpec spec, CheckedRow rejected) {
    }

    private CheckedRow checkRow(int number, ImportRow row, Context context, Set<String> lotsSeen,
                                Map<String, NewProductSpec> newProductsSoFar) {
        String key = productKey(row.sku());
        if (key.isEmpty()) {
            return problem(number, ImportProblem.MISSING_SKU, "This row has no SKU. Every row needs one.", null);
        }

        PharmacyProduct product = context.productsByKey().get(key);
        NewProductSpec spec = null;
        Traits traits;
        if (product != null) {
            CheckedRow unusable = unusableProduct(number, product);
            if (unusable != null) {
                return unusable;
            }
            traits = new Traits(product.isBatchTracked(), product.isExpiryTracked(), product.getDisplayName(),
                    product.getSchedule());
        } else if (newProductsSoFar.containsKey(key)) {
            spec = newProductsSoFar.get(key);
            traits = traitsOf(spec);
        } else {
            SpecOutcome outcome = specForUnknownSku(number, row, key, context);
            if (outcome.rejected() != null) {
                return outcome.rejected();
            }
            spec = outcome.spec();
            newProductsSoFar.put(key, spec);
            traits = traitsOf(spec);
        }

        if (blank(row.quantity())) {
            return catalogueRow(number, product, spec);
        }
        Integer quantity = parsePositiveInt(row.quantity());
        if (quantity == null) {
            return problem(number, ImportProblem.BAD_QUANTITY,
                    "Quantity must be a whole number of 1 or more.", null);
        }
        LocalDate expiry = parseDate(row.expiry());
        String expiryProblem = expiryProblem(traits, row.expiry(), expiry, context.today());
        if (expiryProblem != null) {
            ImportProblem code = expiry != null && expiry.isBefore(context.today())
                    ? ImportProblem.EXPIRED : ImportProblem.BAD_EXPIRY;
            return problem(number, code, expiryProblem, null);
        }
        if (!traits.expiryTracked()) {
            expiry = null;
        }

        String lot = blank(row.lot()) ? "" : row.lot().trim();
        if (traits.batchTracked() && lot.isEmpty()) {
            return problem(number, ImportProblem.MISSING_LOT,
                    "\"" + traits.displayName() + "\" is tracked by lot, so this row needs a lot number.", null);
        }
        if (!traits.batchTracked()) {
            lot = NO_LOT;
        }
        String lotKey = key + "|" + lot.toUpperCase(Locale.ROOT);
        if (!lotsSeen.add(lotKey)) {
            return problem(number, ImportProblem.DUPLICATE_LOT, "Lot \"" + lot + "\" of \"" + traits.displayName()
                    + "\" is already in this file. Combine the two rows or skip one.", null);
        }
        CheckedRow mismatch = lotExpiryMismatch(number, product, traits, lot, expiry, context);
        if (mismatch != null) {
            return mismatch;
        }

        SupplierChoice supplier = chooseSupplier(row, context);
        if (supplier.problem() != null) {
            return problem(number, supplier.problem(), supplier.hint(), supplier.suggestion());
        }
        String invoice = blank(row.invoice()) ? blankToNull(context.fileInvoice()) : row.invoice().trim();
        String warning = duplicateInvoiceWarning(supplier.supplier(), invoice, context);

        ImportRowStatus status = product == null ? ImportRowStatus.NEW_PRODUCT : ImportRowStatus.RESTOCK;
        return new CheckedRow(number, status, null, "", null, warning, product, spec, lot, expiry, quantity,
                supplier.supplier(), invoice, traits.schedule() != null);
    }

    // A row without a quantity adds the product to the catalogue and receives nothing.
    private CheckedRow catalogueRow(int number, PharmacyProduct product, NewProductSpec spec) {
        if (product != null) {
            return problem(number, ImportProblem.ALREADY_IN_CATALOGUE, "\"" + product.getDisplayName()
                    + "\" is already in your catalogue. Add a quantity to receive stock for it, or skip this row.",
                    null);
        }
        return new CheckedRow(number, ImportRowStatus.NEW_PRODUCT, null, "", null, null, null, spec, "", null, 0, null,
                null, false);
    }

    private static Traits traitsOf(NewProductSpec spec) {
        return new Traits(spec.batchTracked(), spec.expiryTracked(), spec.name(), spec.schedule());
    }

    private CheckedRow unusableProduct(int number, PharmacyProduct product) {
        if (!product.isActive()) {
            return problem(number, ImportProblem.ARCHIVED_PRODUCT, "\"" + product.getDisplayName()
                    + "\" is archived. Reactivate it in Stock before importing stock for it.", null);
        }
        if (product.isSerialTracked()) {
            return problem(number, ImportProblem.SERIAL_PRODUCT, "\"" + product.getDisplayName()
                    + "\" needs a serial number for every unit. Receive it through Receive stock.", null);
        }
        if (product.isColdChain()) {
            return problem(number, ImportProblem.COLD_CHAIN_PRODUCT, "\"" + product.getDisplayName()
                    + "\" is cold-chain, so its delivery temperature must be recorded. "
                    + "Receive it through Receive stock.", null);
        }
        return null;
    }

    private SpecOutcome specForUnknownSku(int number, ImportRow row, String key, Context context) {
        PharmacyProduct lookalike = closestProduct(key, context.catalogue());
        if (lookalike != null && !row.confirmNewProduct()) {
            return rejected(problem(number, ImportProblem.SIMILAR_SKU, "No product has the code \""
                    + row.sku().trim() + "\", but \"" + lookalike.getCode() + "\" (" + lookalike.getDisplayName()
                    + ") is very close. Use that code, or confirm this really is a new product.",
                    lookalike.getCode()));
        }
        if (blank(row.name())) {
            return rejected(problem(number, ImportProblem.UNKNOWN_SKU, "No product has the code \""
                    + row.sku().trim() + "\". To create it, fill in the product name. Otherwise check the spelling.",
                    null));
        }

        StockCategory category = parseCategory(row.category());
        if (category == null) {
            return rejected(problem(number, ImportProblem.BAD_CATEGORY, "\"" + row.category().trim()
                    + "\" is not a category we know. Use Medicine, Supply or Device.", null));
        }
        StockBaseUnit unit = blank(row.unit()) ? defaultUnit(category) : parseUnit(row.unit());
        if (unit == null) {
            return rejected(problem(number, ImportProblem.BAD_UNIT, "\"" + row.unit().trim()
                    + "\" is not a unit we know. Use tablet, capsule, bottle, vial, pack, box, kit or each.", null));
        }
        Integer packSize = null;
        if (!blank(row.packSize())) {
            packSize = parsePositiveInt(row.packSize());
            if (packSize == null) {
                return rejected(problem(number, ImportProblem.BAD_PACK_SIZE,
                        "Pack size must be a whole number of 1 or more.", null));
            }
        }
        DrugSchedule schedule = null;
        if (!blank(row.schedule())) {
            schedule = parseSchedule(row.schedule());
            if (schedule == null) {
                return rejected(problem(number, ImportProblem.BAD_SCHEDULE,
                        "Schedule must be 5 or 6, or left empty for an unscheduled medicine.", null));
            }
        }
        // A row with no quantity only builds the catalogue, so there is no lot to learn
        // the tracking from: medicines default to lot and expiry tracking.
        boolean catalogueMedicine = blank(row.quantity()) && category == StockCategory.MEDICINE;
        boolean expiryTracked = !blank(row.expiry()) || catalogueMedicine;
        boolean batchTracked = expiryTracked || !blank(row.lot());
        return new SpecOutcome(new NewProductSpec(row.sku().trim(), row.name().trim(), category, unit, packSize,
                schedule, batchTracked, expiryTracked), null);
    }

    private static SpecOutcome rejected(CheckedRow problem) {
        return new SpecOutcome(null, problem);
    }

    private String expiryProblem(Traits traits, String rawExpiry, LocalDate expiry, LocalDate today) {
        if (!blank(rawExpiry) && expiry == null) {
            return "\"" + rawExpiry.trim() + "\" is not a full date. Use year-month-day, for example 2027-03-31.";
        }
        if (!traits.expiryTracked()) {
            return null;
        }
        if (expiry == null) {
            return "\"" + traits.displayName() + "\" needs an expiry date (year-month-day).";
        }
        if (expiry.isBefore(today)) {
            return "This expiry date (" + DISPLAY_DATE.format(expiry) + ") has already passed. "
                    + "Expired stock can't be received. Refuse it and tell the supplier.";
        }
        return null;
    }

    private CheckedRow lotExpiryMismatch(int number, PharmacyProduct product, Traits traits, String lot,
                                         LocalDate expiry, Context context) {
        if (product == null || !traits.batchTracked()) {
            return null;
        }
        Optional<PharmacyBatch> existing = context.lots().find(product.getId(), lot);
        if (existing.isEmpty()) {
            return null;
        }
        LocalDate onShelf = existing.get().getExpiryDate();
        boolean same = onShelf == null ? expiry == null : onShelf.equals(expiry);
        if (same) {
            return null;
        }
        return problem(number, ImportProblem.LOT_EXPIRY_MISMATCH, "Lot \"" + lot + "\" of \""
                + traits.displayName() + "\" is already in stock with expiry "
                + (onShelf == null ? "none" : DISPLAY_DATE.format(onShelf)) + ", but this row says "
                + (expiry == null ? "none" : DISPLAY_DATE.format(expiry)) + ". Check the lot number.", null);
    }

    private record SupplierChoice(PharmacySupplier supplier, ImportProblem problem, String hint, String suggestion) {
    }

    private SupplierChoice chooseSupplier(ImportRow row, Context context) {
        if (blank(row.supplier())) {
            return new SupplierChoice(context.fileSupplier(), null, null, null);
        }
        String name = row.supplier().trim();
        var match = supplierDetector.findMatch(SupplierNameKey.of(name), context.suppliers());
        if (match.isEmpty()) {
            return new SupplierChoice(null, ImportProblem.UNKNOWN_SUPPLIER, "No supplier is called \"" + name
                    + "\". Add it on the Suppliers page first, pick another, or receive without a supplier.", null);
        }
        if (match.get().similar()) {
            String suggested = match.get().supplier().getName();
            return new SupplierChoice(null, ImportProblem.SIMILAR_SUPPLIER, "No supplier is called \"" + name
                    + "\", but \"" + suggested + "\" is very close. Use it, or receive without a supplier.",
                    suggested);
        }
        return new SupplierChoice(match.get().supplier(), null, null, null);
    }

    private String duplicateInvoiceWarning(PharmacySupplier supplier, String invoice, Context context) {
        if (supplier == null || invoice == null || !context.invoices().alreadyReceived(supplier.getId(), invoice)) {
            return null;
        }
        return "Invoice " + invoice + " from " + supplier.getName()
                + " was already received. Check this file is not being imported twice.";
    }

    private PharmacyProduct closestProduct(String key, Collection<PharmacyProduct> catalogue) {
        PharmacyProduct best = null;
        int bestDistance = Integer.MAX_VALUE;
        for (PharmacyProduct candidate : catalogue) {
            if (!candidate.isActive()) {
                continue;
            }
            String candidateKey = productKey(candidate.getCode());
            if (Math.min(candidateKey.length(), key.length()) < MIN_SIMILAR_LENGTH) {
                continue;
            }
            int distance = editDistance(key, candidateKey);
            boolean contained = key.contains(candidateKey) || candidateKey.contains(key);
            if ((distance <= MAX_TYPO_DISTANCE || contained) && distance < bestDistance) {
                best = candidate;
                bestDistance = distance;
            }
        }
        return best;
    }

    // Plain Levenshtein distance; SKUs are short, so the simple version is fast enough.
    static int editDistance(String a, String b) {
        int[] previous = new int[b.length() + 1];
        int[] current = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) {
            previous[j] = j;
        }
        for (int i = 1; i <= a.length(); i++) {
            current[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int substitution = previous[j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1);
                current[j] = Math.min(substitution, Math.min(previous[j] + 1, current[j - 1] + 1));
            }
            int[] swap = previous;
            previous = current;
            current = swap;
        }
        return previous[b.length()];
    }

    private static StockCategory parseCategory(String raw) {
        if (blank(raw)) {
            return StockCategory.MEDICINE;
        }
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "medicine", "medicines", "medication", "drug", "tablet", "tablets", "capsule", "capsules",
                 "syrup", "injection", "cream", "ointment" -> StockCategory.MEDICINE;
            case "supply", "supplies", "consumable", "consumables" -> StockCategory.SUPPLY;
            case "device", "devices", "equipment" -> StockCategory.DEVICE;
            default -> null;
        };
    }

    private static StockBaseUnit defaultUnit(StockCategory category) {
        return category == StockCategory.MEDICINE ? StockBaseUnit.TABLET : StockBaseUnit.EACH;
    }

    // Accepts the unit as written, or with a plural s or es removed
    // (tablets, boxes, ampoules).
    private static StockBaseUnit parseUnit(String raw) {
        String word = raw.trim().toLowerCase(Locale.ROOT).replace(' ', '_');
        for (String candidate : List.of(word, withoutSuffix(word, "s"), withoutSuffix(word, "es"))) {
            StockBaseUnit unit = unitNamed(candidate);
            if (unit != null) {
                return unit;
            }
        }
        return null;
    }

    private static String withoutSuffix(String word, String suffix) {
        return word.endsWith(suffix) ? word.substring(0, word.length() - suffix.length()) : word;
    }

    private static StockBaseUnit unitNamed(String word) {
        return switch (word) {
            case "tablet" -> StockBaseUnit.TABLET;
            case "capsule" -> StockBaseUnit.CAPSULE;
            case "bottle" -> StockBaseUnit.BOTTLE;
            case "vial", "ampoule" -> StockBaseUnit.VIAL;
            case "pack", "sealed_pack" -> StockBaseUnit.SEALED_PACK;
            case "each", "unit", "piece" -> StockBaseUnit.EACH;
            case "box" -> StockBaseUnit.BOX;
            case "kit" -> StockBaseUnit.KIT;
            default -> null;
        };
    }

    private static DrugSchedule parseSchedule(String raw) {
        String digits = raw.trim().toLowerCase(Locale.ROOT).replace("schedule", "").replace("s", "").trim();
        return switch (digits) {
            case "5" -> DrugSchedule.S5;
            case "6" -> DrugSchedule.S6;
            default -> null;
        };
    }

    private static Integer parsePositiveInt(String raw) {
        try {
            int value = Integer.parseInt(raw == null ? "" : raw.trim());
            return value >= 1 ? value : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // Spreadsheets save dates either as 2027-03-31 or as 31/03/2027.
    static LocalDate parseDate(String raw) {
        if (blank(raw)) {
            return null;
        }
        String text = raw.trim();
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException ignored) {
            // Not year-month-day; try day/month/year next.
        }
        try {
            return LocalDate.parse(text, DAY_FIRST);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static boolean blank(String text) {
        return text == null || text.isBlank();
    }

    private static String blankToNull(String text) {
        return blank(text) ? null : text.trim();
    }

    private static CheckedRow problem(int number, ImportProblem problem, String hint, String suggestion) {
        return new CheckedRow(number, ImportRowStatus.PROBLEM, problem, hint, suggestion, null, null, null, null,
                null, 0, null, null, false);
    }
}
