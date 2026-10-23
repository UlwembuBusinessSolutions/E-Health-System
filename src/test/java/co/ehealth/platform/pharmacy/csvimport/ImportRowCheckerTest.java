package co.ehealth.platform.pharmacy.csvimport;

import co.ehealth.platform.pharmacy.PharmacyTestData;
import co.ehealth.platform.pharmacy.csvimport.ImportRowChecker.CheckedRow;
import co.ehealth.platform.pharmacy.csvimport.ImportRowChecker.Context;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.StockBaseUnit;
import co.ehealth.platform.pharmacy.stock.StockCategory;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.SupplierDuplicateDetector;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ImportRowCheckerTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 4);

    private final ImportRowChecker checker = new ImportRowChecker(new SupplierDuplicateDetector());

    private final PharmacyProduct amoxicillin = PharmacyTestData.lotTrackedProduct("AMOX-500-CAP", "Amoxicillin 500 mg");
    private final PharmacyProduct bandage = PharmacyTestData.quantityOnlyProduct("BAND-CREPE", "Crepe bandage");
    private final PharmacySupplier medSupply = PharmacyTestData.supplier("MedSupply Wholesalers");

    private Context context(PharmacySupplier fileSupplier, Set<String> invoicesAlreadyReceived) {
        Map<String, PharmacyProduct> products = new HashMap<>();
        for (PharmacyProduct product : List.of(amoxicillin, bandage)) {
            products.put(ImportRowChecker.productKey(product.getCode()), product);
        }
        return new Context(products, products.values(), List.of(medSupply), fileSupplier, null, TODAY,
                (productId, lot) -> Optional.empty(),
                (supplierId, invoice) -> invoicesAlreadyReceived.contains(invoice));
    }

    private Context context() {
        return context(null, Set.of());
    }

    private static ImportRow row(String sku, String name, String lot, String expiry, String quantity) {
        return new ImportRow(sku, name, "", "", "", "", lot, expiry, quantity, "", "", false);
    }

    private CheckedRow only(ImportRow row) {
        return checker.check(List.of(row), context()).get(0);
    }

    @Test
    void aKnownSkuWithGoodDetailsIsARestock() {
        CheckedRow checked = only(row("amox-500-cap", "", "AX2388", "2027-06-30", "240"));

        assertThat(checked.status()).isEqualTo(ImportRowStatus.RESTOCK);
        assertThat(checked.product()).isSameAs(amoxicillin);
        assertThat(checked.quantity()).isEqualTo(240);
        assertThat(checked.expiry()).isEqualTo(LocalDate.of(2027, 6, 30));
    }

    @Test
    void anUnknownSkuWithANameIsANewProductDefaultingToMedicineTablets() {
        CheckedRow checked = only(row("IBU-400-TAB", "Ibuprofen 400 mg", "IB4410", "2027-03-31", "500"));

        assertThat(checked.status()).isEqualTo(ImportRowStatus.NEW_PRODUCT);
        assertThat(checked.newProduct().category()).isEqualTo(StockCategory.MEDICINE);
        assertThat(checked.newProduct().unit()).isEqualTo(StockBaseUnit.TABLET);
        assertThat(checked.newProduct().batchTracked()).isTrue();
        assertThat(checked.newProduct().expiryTracked()).isTrue();
    }

    @Test
    void aNewProductWithNoLotOrExpiryIsTrackedByQuantityOnly() {
        ImportRow syringe = new ImportRow("SYR-5ML", "Syringe 5 ml", "supply", "", "", "", "", "", "1000", "", "",
                false);

        CheckedRow checked = only(syringe);

        assertThat(checked.status()).isEqualTo(ImportRowStatus.NEW_PRODUCT);
        assertThat(checked.newProduct().category()).isEqualTo(StockCategory.SUPPLY);
        assertThat(checked.newProduct().unit()).isEqualTo(StockBaseUnit.EACH);
        assertThat(checked.newProduct().batchTracked()).isFalse();
        assertThat(checked.lot()).isEqualTo("N/A");
    }

    @Test
    void aScheduledNewProductIsFlaggedForTheRegister() {
        ImportRow morphine = new ImportRow("MORPH-10-AMP", "Morphine 10 mg", "", "ampoules", "", "Schedule 6",
                "MP5521", "2028-01-31", "50", "", "", false);

        CheckedRow checked = only(morphine);

        assertThat(checked.status()).isEqualTo(ImportRowStatus.NEW_PRODUCT);
        assertThat(checked.scheduled()).isTrue();
        assertThat(checked.newProduct().unit()).isEqualTo(StockBaseUnit.VIAL);
    }

    @Test
    void aTypoedSkuIsHeldBackWithTheCloseMatchSuggested() {
        CheckedRow checked = only(row("AMXO-500-CAP", "Amoxicillin 500 mg", "AX2390", "2027-01-31", "120"));

        assertThat(checked.problem()).isEqualTo(ImportProblem.SIMILAR_SKU);
        assertThat(checked.suggestion()).isEqualTo("AMOX-500-CAP");
    }

    @Test
    void confirmingTheLookAlikeIsReallyNewLetsItThrough() {
        ImportRow confirmed = new ImportRow("AMXO-500-CAP", "Amoxicillin 500 mg", "", "", "", "", "AX2390",
                "2027-01-31", "120", "", "", true);

        assertThat(only(confirmed).status()).isEqualTo(ImportRowStatus.NEW_PRODUCT);
    }

    @Test
    void anUnknownSkuWithoutANameCannotCreateAProduct() {
        CheckedRow checked = only(row("ZZZ-NOPE-1", "", "L1", "2027-01-31", "10"));

        assertThat(checked.problem()).isEqualTo(ImportProblem.UNKNOWN_SKU);
    }

    @Test
    void anExpiredLotIsRefused() {
        CheckedRow checked = only(row("AMOX-500-CAP", "", "AX1", "2026-01-31", "10"));

        assertThat(checked.problem()).isEqualTo(ImportProblem.EXPIRED);
    }

    @Test
    void aMissingExpiryOnAnExpiryTrackedProductIsRefused() {
        assertThat(only(row("AMOX-500-CAP", "", "AX1", "", "10")).problem()).isEqualTo(ImportProblem.BAD_EXPIRY);
        assertThat(only(row("AMOX-500-CAP", "", "AX1", "31st of March", "10")).problem())
                .isEqualTo(ImportProblem.BAD_EXPIRY);
    }

    @Test
    void dayFirstDatesFromSpreadsheetsAreAccepted() {
        CheckedRow checked = only(row("AMOX-500-CAP", "", "AX1", "30/06/2027", "10"));

        assertThat(checked.expiry()).isEqualTo(LocalDate.of(2027, 6, 30));
    }

    @Test
    void aLotTrackedProductNeedsALotNumber() {
        assertThat(only(row("AMOX-500-CAP", "", "", "2027-06-30", "10")).problem()).isEqualTo(ImportProblem.MISSING_LOT);
    }

    @Test
    void quantityMustBeAWholeNumberOfOneOrMore() {
        assertThat(only(row("AMOX-500-CAP", "", "AX1", "2027-06-30", "0")).problem()).isEqualTo(ImportProblem.BAD_QUANTITY);
        assertThat(only(row("AMOX-500-CAP", "", "AX1", "2027-06-30", "12.5")).problem()).isEqualTo(ImportProblem.BAD_QUANTITY);
        assertThat(only(row("AMOX-500-CAP", "", "AX1", "2027-06-30", "-4")).problem()).isEqualTo(ImportProblem.BAD_QUANTITY);
    }

    @Test
    void theSameLotTwiceInOneFileIsFlaggedOnTheSecondRow() {
        List<CheckedRow> checked = checker.check(List.of(
                row("AMOX-500-CAP", "", "AX1", "2027-06-30", "10"),
                row("AMOX-500-CAP", "", "ax1", "2027-06-30", "20")), context());

        assertThat(checked.get(0).status()).isEqualTo(ImportRowStatus.RESTOCK);
        assertThat(checked.get(1).problem()).isEqualTo(ImportProblem.DUPLICATE_LOT);
    }

    @Test
    void aLotAlreadyOnTheShelfWithAnotherExpiryIsRefused() {
        var existingBatch = new co.ehealth.platform.pharmacy.stock.PharmacyBatch(amoxicillin.getId(), null, "AX1",
                LocalDate.of(2027, 1, 31), null, null, UUID.randomUUID(), "Test", PharmacyTestData.CLOCK.instant());
        Context withBatch = new Context(Map.of("AMOX-500-CAP", amoxicillin), List.of(amoxicillin), List.of(), null,
                null, TODAY, (productId, lot) -> Optional.of(existingBatch), (supplierId, invoice) -> false);

        CheckedRow checked = checker.check(List.of(row("AMOX-500-CAP", "", "AX1", "2027-06-30", "10")), withBatch)
                .get(0);

        assertThat(checked.problem()).isEqualTo(ImportProblem.LOT_EXPIRY_MISMATCH);
    }

    @Test
    void aSecondRowOfTheSameNewProductReusesItAsLongAsTrackingMatches() {
        List<CheckedRow> checked = checker.check(List.of(
                row("IBU-400-TAB", "Ibuprofen 400 mg", "IB1", "2027-03-31", "100"),
                row("IBU-400-TAB", "", "IB2", "2027-04-30", "200"),
                row("IBU-400-TAB", "", "", "2027-05-31", "50")), context());

        assertThat(checked.get(0).status()).isEqualTo(ImportRowStatus.NEW_PRODUCT);
        assertThat(checked.get(1).status()).isEqualTo(ImportRowStatus.NEW_PRODUCT);
        assertThat(checked.get(2).problem()).isEqualTo(ImportProblem.MISSING_LOT);
    }

    @Test
    void serialColdChainAndArchivedProductsAreSentToReceiveStock() {
        PharmacyProduct glucometer = PharmacyTestData.serialProduct("GLUC-METER", "Glucometer");
        PharmacyProduct vaccine = PharmacyTestData.coldChainProduct("VAC-FLU", "Flu vaccine");
        Map<String, PharmacyProduct> products = Map.of("GLUC-METER", glucometer, "VAC-FLU", vaccine);
        Context context = new Context(products, products.values(), List.of(), null, null, TODAY,
                (productId, lot) -> Optional.empty(), (supplierId, invoice) -> false);

        List<CheckedRow> checked = checker.check(List.of(row("GLUC-METER", "", "", "", "12"),
                row("VAC-FLU", "", "V1", "2027-01-01", "30")), context);

        assertThat(checked.get(0).problem()).isEqualTo(ImportProblem.SERIAL_PRODUCT);
        assertThat(checked.get(1).problem()).isEqualTo(ImportProblem.COLD_CHAIN_PRODUCT);
    }

    @Test
    void theFileLevelSupplierAppliesToRowsWithoutOne() {
        CheckedRow checked = checker.check(List.of(row("AMOX-500-CAP", "", "AX1", "2027-06-30", "10")),
                context(medSupply, Set.of())).get(0);

        assertThat(checked.supplier()).isSameAs(medSupply);
    }

    @Test
    void aSupplierNamedInTheRowIsMatchedAndAnUnknownOneIsHeldBack() {
        ImportRow known = new ImportRow("AMOX-500-CAP", "", "", "", "", "", "AX1", "2027-06-30", "10",
                "medsupply wholesalers (pty) ltd", "", false);
        ImportRow similar = new ImportRow("AMOX-500-CAP", "", "", "", "", "", "AX2", "2027-06-30", "10",
                "MedSupply Wholesaler", "", false);
        ImportRow stranger = new ImportRow("AMOX-500-CAP", "", "", "", "", "", "AX3", "2027-06-30", "10",
                "Acme Imports", "", false);

        List<CheckedRow> checked = checker.check(List.of(known, similar, stranger), context());

        assertThat(checked.get(0).supplier()).isSameAs(medSupply);
        assertThat(checked.get(1).problem()).isEqualTo(ImportProblem.SIMILAR_SUPPLIER);
        assertThat(checked.get(1).suggestion()).isEqualTo("MedSupply Wholesalers");
        assertThat(checked.get(2).problem()).isEqualTo(ImportProblem.UNKNOWN_SUPPLIER);
    }

    @Test
    void anInvoiceThatWasAlreadyReceivedGivesAWarningButStillImports() {
        ImportRow reused = new ImportRow("AMOX-500-CAP", "", "", "", "", "", "AX1", "2027-06-30", "10", "", "INV-77",
                false);

        CheckedRow checked = checker.check(List.of(reused), context(medSupply, Set.of("INV-77"))).get(0);

        assertThat(checked.status()).isEqualTo(ImportRowStatus.RESTOCK);
        assertThat(checked.warning()).contains("INV-77").contains("already received");
    }

    @Test
    void rowsWithBadNewProductDetailsAreExplained() {
        ImportRow badCategory = new ImportRow("NEW-AAA-1", "Thing", "furniture", "", "", "", "", "", "5", "", "", false);
        ImportRow badUnit = new ImportRow("NEW-BBB-2", "Thing", "", "gallons", "", "", "", "", "5", "", "", false);
        ImportRow badSchedule = new ImportRow("NEW-CCC-3", "Thing", "", "", "", "9", "", "", "5", "", "", false);

        List<CheckedRow> checked = checker.check(List.of(badCategory, badUnit, badSchedule), context());

        assertThat(checked.get(0).problem()).isEqualTo(ImportProblem.BAD_CATEGORY);
        assertThat(checked.get(1).problem()).isEqualTo(ImportProblem.BAD_UNIT);
        assertThat(checked.get(2).problem()).isEqualTo(ImportProblem.BAD_SCHEDULE);
    }

    @Test
    void aRowWithoutAQuantityOnlyAddsTheProductToTheCatalogue() {
        ImportRow catalogue = new ImportRow("CET-10-TAB", "Cetirizine 10 mg", "", "tablet", "30", "", "", "", "", "",
                "", false);

        CheckedRow checked = only(catalogue);

        assertThat(checked.status()).isEqualTo(ImportRowStatus.NEW_PRODUCT);
        assertThat(checked.quantity()).isZero();
        assertThat(checked.scheduled()).isFalse();
        assertThat(checked.newProduct().batchTracked()).isTrue();
        assertThat(checked.newProduct().expiryTracked()).isTrue();
    }

    @Test
    void aSupplyInTheCatalogueIsNotLotTrackedByDefault() {
        ImportRow gloves = new ImportRow("GLOVE-M", "Exam gloves M", "supply", "box", "", "", "", "", "", "", "",
                false);

        CheckedRow checked = only(gloves);

        assertThat(checked.newProduct().batchTracked()).isFalse();
        assertThat(checked.newProduct().expiryTracked()).isFalse();
    }

    @Test
    void aCatalogueRowForAProductThatExistsIsPointedOut() {
        assertThat(only(row("AMOX-500-CAP", "", "", "", "")).problem()).isEqualTo(ImportProblem.ALREADY_IN_CATALOGUE);
    }

    @Test
    void editDistanceCountsSingleEdits() {
        assertThat(ImportRowChecker.editDistance("AMOX", "AMOX")).isZero();
        assertThat(ImportRowChecker.editDistance("AMOX", "AMXO")).isEqualTo(2);
        assertThat(ImportRowChecker.editDistance("PARA", "PARAS")).isEqualTo(1);
    }
}
