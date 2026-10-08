package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.receiving.ReceiptLineValidator;
import co.ehealth.platform.pharmacy.stock.ExpiryPrecision;
import co.ehealth.platform.pharmacy.stock.MissingExpiryException;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptService.LineFlag;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptService.ReceiveLineCommand;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import co.ehealth.platform.pharmacy.stock.ReceiptFlagReason;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PharmacyReceiptLineValidatorTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 4);

    private final ReceiptLineValidator validator = new ReceiptLineValidator(PharmacyTestData.CLOCK);
    private final PharmacyProduct amoxicillin = PharmacyTestData.lotTrackedProduct("AMOX500", "Amoxicillin 500mg");
    private final PharmacyProduct insulin = PharmacyTestData.coldChainProduct("INS100", "Insulin 100 IU/ml");
    private final PharmacyProduct glucometer = PharmacyTestData.serialProduct("GLU1", "Glucometer");

    private ReceiveLineCommand line(PharmacyProduct product, LocalDate expiry, ExpiryPrecision precision,
                                    Integer quantity, List<String> serials, BigDecimal temperature,
                                    Boolean boxIntact, LineFlag flag) {
        return new ReceiveLineCommand(product.getId(), null, "LOT1", expiry, precision, null, null, quantity,
                serials, temperature, boxIntact, flag);
    }

    private ReceiveLineCommand plainLine(PharmacyProduct product, LocalDate expiry) {
        return line(product, expiry, null, 30, null, null, null, null);
    }

    @Test
    void acceptsFutureFullDayExpiry() {
        assertDoesNotThrow(() -> validator.validate(amoxicillin, plainLine(amoxicillin, TODAY.plusMonths(8))));
    }

    @Test
    void rejectsAnExpiryThatHasAlreadyPassed() {
        var ex = assertThrows(PharmacyValidationException.class,
                () -> validator.validate(amoxicillin, plainLine(amoxicillin, TODAY.minusDays(1))));

        assertTrue(ex.getMessage().contains("3 Oct 2026"));
        assertTrue(ex.getMessage().contains("Expired stock can't be received"));
    }

    @Test
    void expiryTodayIsStillUsable() {
        assertDoesNotThrow(() -> validator.validate(amoxicillin, plainLine(amoxicillin, TODAY)));
    }

    @Test
    void expiryDateIsRequiredForExpiryTrackedProducts() {
        assertThrows(MissingExpiryException.class, () -> validator.validate(amoxicillin, plainLine(amoxicillin, null)));
    }

    @Test
    void monthOnlyExpiryIsRejected() {
        var monthOnly = line(amoxicillin, TODAY.plusMonths(8), ExpiryPrecision.MONTH, 30, null, null, null, null);

        var ex = assertThrows(PharmacyValidationException.class, () -> validator.validate(amoxicillin, monthOnly));

        assertTrue(ex.getMessage().contains("full expiry date"));
    }

    @Test
    void aFullDateWithNoStatedPrecisionCountsAsDayPrecision() {
        assertEquals(ExpiryPrecision.DAY, plainLine(amoxicillin, TODAY.plusDays(90)).expiryPrecision());
    }

    @Test
    void quantityMustBePositive() {
        var zero = line(amoxicillin, TODAY.plusDays(90), null, 0, null, null, null, null);

        assertThrows(PharmacyValidationException.class, () -> validator.validate(amoxicillin, zero));
    }

    @Test
    void coldChainBreachNeedsAFlag() {
        var tooWarm = line(insulin, TODAY.plusDays(90), null, 10, null, new BigDecimal("10"), true, null);

        assertThrows(PharmacyValidationException.class, () -> validator.validate(insulin, tooWarm));
    }

    @Test
    void coldChainBreachWithAFlagIsAllowed() {
        var flag = new LineFlag(ReceiptFlagReason.DAMAGED, "Box warm to the touch", 0);
        var tooWarm = line(insulin, TODAY.plusDays(90), null, 10, null, new BigDecimal("10"), true, flag);

        assertDoesNotThrow(() -> validator.validate(insulin, tooWarm));
    }

    @Test
    void flaggedLineStocksOnlyTheAcceptedQuantity() {
        var flag = new LineFlag(ReceiptFlagReason.SHORT, null, 24);
        var flagged = line(amoxicillin, TODAY.plusDays(90), null, 30, null, null, null, flag);

        validator.validate(amoxicillin, flagged);

        assertEquals(24, flagged.stockedQuantity());
        assertEquals(6, flagged.rejectedQuantity());
    }

    @Test
    void acceptedQuantityCannotExceedWhatWasDelivered() {
        var flag = new LineFlag(ReceiptFlagReason.SHORT, null, 31);

        assertThrows(PharmacyValidationException.class, () -> validator.validate(amoxicillin,
                line(amoxicillin, TODAY.plusDays(90), null, 30, null, null, null, flag)));
    }

    @Test
    void flagNeedsAReasonAndAnAcceptedQuantity() {
        var noReason = new LineFlag(null, null, 5);
        var noAccepted = new LineFlag(ReceiptFlagReason.DAMAGED, null, null);

        assertThrows(PharmacyValidationException.class, () -> validator.validate(amoxicillin,
                line(amoxicillin, TODAY.plusDays(90), null, 30, null, null, null, noReason)));
        assertThrows(PharmacyValidationException.class, () -> validator.validate(amoxicillin,
                line(amoxicillin, TODAY.plusDays(90), null, 30, null, null, null, noAccepted)));
    }

    @Test
    void serialTrackedLineNeedsOneSerialPerAcceptedUnit() {
        var oneShort = line(glucometer, null, null, 3, List.of("A1", "A2"), null, null, null);
        var complete = line(glucometer, null, null, 2, List.of("A1", "A2"), null, null, null);

        assertThrows(PharmacyValidationException.class, () -> validator.validate(glucometer, oneShort));
        assertDoesNotThrow(() -> validator.validate(glucometer, complete));
    }

    @Test
    void serialCountFollowsTheAcceptedQuantityWhenFlagged() {
        var flag = new LineFlag(ReceiptFlagReason.DAMAGED, null, 1);
        var oneAcceptedOfTwo = line(glucometer, null, null, 2, List.of("A1"), null, null, flag);

        assertDoesNotThrow(() -> validator.validate(glucometer, oneAcceptedOfTwo));
    }

    @Test
    void serialNumbersOnANonSerialProductAreRejected() {
        var withSerials = line(amoxicillin, TODAY.plusDays(90), null, 1, List.of("A1"), null, null, null);

        assertThrows(PharmacyValidationException.class, () -> validator.validate(amoxicillin, withSerials));
    }
}
