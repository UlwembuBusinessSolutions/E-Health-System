package co.ehealth.platform.pharmacy.openingstock;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

// Checks every row of an opening-stock sheet and explains each problem in
// plain language. Pure logic over already-loaded products, so the same
// verdicts back both the preview (validate) and the real posting.
@Component
public class OpeningStockRowValidator {

    static final String NO_LOT = "N/A";

    private final Clock clock;

    public OpeningStockRowValidator(Clock clock) {
        this.clock = clock;
    }

    // What a row resolved to. product/lot/expiry/quantity are only meaningful
    // when status is OK.
    public record RowCheck(OpeningRowStatus status, String hint, PharmacyProduct product, String lot,
                           LocalDate expiry, int quantity) {

        static RowCheck rejected(OpeningRowStatus status, String hint, PharmacyProduct product) {
            return new RowCheck(status, hint, product, null, null, 0);
        }

        public boolean isOk() {
            return status == OpeningRowStatus.OK;
        }
    }

    public static String productKey(String sku) {
        return sku == null ? "" : sku.trim().toUpperCase(Locale.ROOT);
    }

    public List<RowCheck> check(List<OpeningStockRow> rows, Map<String, PharmacyProduct> productsByKey) {
        Set<String> lotsSeen = new HashSet<>();
        List<RowCheck> checks = new ArrayList<>();
        for (OpeningStockRow row : rows) {
            checks.add(checkRow(row, productsByKey.get(productKey(row.sku())), lotsSeen));
        }
        return checks;
    }

    private RowCheck checkRow(OpeningStockRow row, PharmacyProduct product, Set<String> lotsSeen) {
        if (product == null || !product.isActive()) {
            return RowCheck.rejected(OpeningRowStatus.UNKNOWN_PRODUCT, product == null
                    ? "No product has the code \"" + row.sku() + "\". Add the product first, then load its stock."
                    : "\"" + product.getDisplayName() + "\" is archived. Reactivate it before loading stock.", product);
        }
        if (product.isSerialTracked()) {
            return RowCheck.rejected(OpeningRowStatus.SERIAL_PRODUCT, "\"" + product.getDisplayName()
                    + "\" is tracked by serial number. Receive it through Receive stock so each unit gets its serial.",
                    product);
        }
        Integer quantity = parseQuantity(row.quantity());
        if (quantity == null) {
            return RowCheck.rejected(OpeningRowStatus.BAD_QUANTITY,
                    "Quantity must be a whole number of 1 or more.", product);
        }
        LocalDate expiry = parseDate(row.expiry());
        String expiryProblem = expiryProblem(product, row.expiry(), expiry);
        if (expiryProblem != null) {
            return RowCheck.rejected(OpeningRowStatus.BAD_EXPIRY, expiryProblem, product);
        }
        String lot = product.isBatchTracked() && row.lot() != null && !row.lot().isBlank()
                ? row.lot().trim() : NO_LOT;
        boolean firstTimeSeen = lotsSeen.add(product.getId() + "|" + lot.toUpperCase(Locale.ROOT));
        if (!firstTimeSeen) {
            return RowCheck.rejected(OpeningRowStatus.DUPLICATE_LOT, "Lot \"" + lot + "\" of \""
                    + product.getDisplayName() + "\" appears more than once. Combine the rows into one.", product);
        }
        return new RowCheck(OpeningRowStatus.OK, "", product, lot, expiry, quantity);
    }

    private String expiryProblem(PharmacyProduct product, String rawExpiry, LocalDate expiry) {
        if (!product.isExpiryTracked()) {
            return null;
        }
        if (expiry == null) {
            return rawExpiry == null || rawExpiry.isBlank()
                    ? "\"" + product.getDisplayName() + "\" needs an expiry date (YYYY-MM-DD)."
                    : "\"" + rawExpiry.trim() + "\" is not a full date. Use YYYY-MM-DD, for example 2027-03-31.";
        }
        if (expiry.isBefore(LocalDate.now(clock))) {
            return "This expiry date has already passed. Expired stock shouldn't be loaded - dispose of it first.";
        }
        return null;
    }

    private static Integer parseQuantity(String raw) {
        try {
            int quantity = Integer.parseInt(raw == null ? "" : raw.trim());
            return quantity >= 1 ? quantity : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
