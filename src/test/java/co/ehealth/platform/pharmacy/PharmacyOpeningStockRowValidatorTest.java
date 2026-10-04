package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.openingstock.OpeningRowStatus;
import co.ehealth.platform.pharmacy.openingstock.OpeningStockRow;
import co.ehealth.platform.pharmacy.openingstock.OpeningStockRowValidator;
import co.ehealth.platform.pharmacy.openingstock.OpeningStockRowValidator.RowCheck;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PharmacyOpeningStockRowValidatorTest {

    private final OpeningStockRowValidator validator = new OpeningStockRowValidator(PharmacyTestData.CLOCK);

    private final PharmacyProduct amoxicillin = PharmacyTestData.lotTrackedProduct("AMOX500", "Amoxicillin 500mg");
    private final PharmacyProduct plasters = PharmacyTestData.product("PLAST", "Plasters", false, false,
            new co.ehealth.platform.pharmacy.stock.ProductHandling(false, null, false, null));
    private final PharmacyProduct glucometer = PharmacyTestData.serialProduct("GLU1", "Glucometer");

    private final Map<String, PharmacyProduct> catalogue = Map.of("AMOX500", amoxicillin, "PLAST", plasters,
            "GLU1", glucometer);

    private RowCheck checkOne(OpeningStockRow row) {
        return validator.check(List.of(row), catalogue).get(0);
    }

    private static OpeningStockRow row(String sku, String lot, String expiry, String quantity) {
        return new OpeningStockRow(sku, lot, expiry, quantity);
    }

    @Test
    void validRowIsOkAndCarriesParsedValues() {
        RowCheck check = checkOne(row("amox500", " LOT-9 ", "2027-03-31", "120"));

        assertTrue(check.isOk());
        assertEquals(amoxicillin, check.product());
        assertEquals("LOT-9", check.lot());
        assertEquals(LocalDate.of(2027, 3, 31), check.expiry());
        assertEquals(120, check.quantity());
    }

    @Test
    void unknownSkuIsReportedWithTheCodeThatWasTyped() {
        RowCheck check = checkOne(row("NOPE", "L1", "2027-03-31", "5"));

        assertEquals(OpeningRowStatus.UNKNOWN_PRODUCT, check.status());
        assertTrue(check.hint().contains("NOPE"));
    }

    @Test
    void archivedProductIsTreatedAsUnknownWithAHintToReactivate() {
        amoxicillin.archive(null, "Test", PharmacyTestData.CLOCK.instant());

        RowCheck check = checkOne(row("AMOX500", "L1", "2027-03-31", "5"));

        assertEquals(OpeningRowStatus.UNKNOWN_PRODUCT, check.status());
        assertTrue(check.hint().contains("archived"));
    }

    @Test
    void serialTrackedProductsAreRedirectedToReceiving() {
        RowCheck check = checkOne(row("GLU1", null, null, "3"));

        assertEquals(OpeningRowStatus.SERIAL_PRODUCT, check.status());
    }

    @Test
    void quantityMustBeAWholePositiveNumber() {
        for (String bad : new String[]{"0", "-4", "2.5", "ten", "", "  "}) {
            assertEquals(OpeningRowStatus.BAD_QUANTITY,
                    checkOne(row("AMOX500", "L1", "2027-03-31", bad)).status(), "quantity '" + bad + "'");
        }
        assertEquals(OpeningRowStatus.BAD_QUANTITY, checkOne(row("AMOX500", "L1", "2027-03-31", null)).status());
    }

    @Test
    void expiryTrackedProductNeedsAFullIsoDate() {
        for (String bad : new String[]{null, "", "2027-03", "31/03/2027", "soon"}) {
            assertEquals(OpeningRowStatus.BAD_EXPIRY, checkOne(row("AMOX500", "L1", bad, "5")).status(),
                    "expiry '" + bad + "'");
        }
    }

    @Test
    void expiryInThePastIsRejectedButTodayIsFine() {
        assertEquals(OpeningRowStatus.BAD_EXPIRY, checkOne(row("AMOX500", "L1", "2026-10-03", "5")).status());
        assertEquals(OpeningRowStatus.OK, checkOne(row("AMOX500", "L1", "2026-10-04", "5")).status());
    }

    @Test
    void productWithoutExpiryTrackingIgnoresTheExpiryColumn() {
        assertEquals(OpeningRowStatus.OK, checkOne(row("PLAST", null, null, "40")).status());
    }

    @Test
    void sameLotTwiceInTheSheetIsADuplicate() {
        List<RowCheck> checks = validator.check(List.of(
                row("AMOX500", "L1", "2027-03-31", "5"),
                row("AMOX500", "l1", "2027-03-31", "9")), catalogue);

        assertEquals(OpeningRowStatus.OK, checks.get(0).status());
        assertEquals(OpeningRowStatus.DUPLICATE_LOT, checks.get(1).status());
        assertTrue(checks.get(1).hint().contains("more than once"));
    }

    @Test
    void sameLotNumberOnDifferentProductsIsNotADuplicate() {
        List<RowCheck> checks = validator.check(List.of(
                row("AMOX500", "L1", "2027-03-31", "5"),
                row("PLAST", "L1", null, "9")), catalogue);

        assertTrue(checks.stream().allMatch(RowCheck::isOk));
    }

    @Test
    void untrackedProductRepeatedTwiceIsADuplicateBecauseItHasOnlyOneLot() {
        List<RowCheck> checks = validator.check(List.of(
                row("PLAST", null, null, "10"),
                row("PLAST", "ANY", null, "20")), catalogue);

        assertEquals(OpeningRowStatus.DUPLICATE_LOT, checks.get(1).status());
    }

    @Test
    void aRejectedRowDoesNotUseUpItsLot() {
        List<RowCheck> checks = validator.check(List.of(
                row("AMOX500", "L1", "bad-date", "5"),
                row("AMOX500", "L1", "2027-03-31", "5")), catalogue);

        assertEquals(OpeningRowStatus.BAD_EXPIRY, checks.get(0).status());
        assertEquals(OpeningRowStatus.OK, checks.get(1).status());
        assertFalse(checks.get(0).isOk());
    }

    @Test
    void blankLotOnATrackedProductFallsBackToTheNoLotMarker() {
        assertEquals("N/A", checkOne(row("AMOX500", "  ", "2027-03-31", "5")).lot());
    }
}
