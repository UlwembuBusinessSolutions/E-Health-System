package co.ehealth.platform.pharmacy.stock;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PharmacyAdjustmentRulesTest {

    private static void validate(AdjustmentMode mode, AdjustmentReason reason, String note) {
        AdjustmentRules.validate(mode, reason, note, 5, null, false);
    }

    @Test
    void otherRequiresANoteOfAtLeastThreeCharacters() {
        assertThrows(InvalidStockRequestException.class, () -> validate(AdjustmentMode.REMOVE, AdjustmentReason.OTHER, null));
        assertThrows(InvalidStockRequestException.class, () -> validate(AdjustmentMode.REMOVE, AdjustmentReason.OTHER, "  a "));
        assertDoesNotThrow(() -> validate(AdjustmentMode.REMOVE, AdjustmentReason.OTHER, "Spilled"));
    }

    @Test
    void namedReasonsNeedNoNote() {
        assertDoesNotThrow(() -> validate(AdjustmentMode.REMOVE, AdjustmentReason.DAMAGED, null));
        assertDoesNotThrow(() -> validate(AdjustmentMode.ADD, AdjustmentReason.FOUND_IN_COUNT, null));
    }

    @Test
    void reasonMustMatchTheDirection() {
        assertThrows(InvalidStockRequestException.class, () -> validate(AdjustmentMode.ADD, AdjustmentReason.EXPIRED, null));
        assertThrows(InvalidStockRequestException.class,
                () -> validate(AdjustmentMode.REMOVE, AdjustmentReason.RETURNED_BY_PATIENT, null));
    }

    @Test
    void wrongEntryIsValidInBothDirections() {
        assertDoesNotThrow(() -> validate(AdjustmentMode.ADD, AdjustmentReason.WRONG_ENTRY, null));
        assertDoesNotThrow(() -> validate(AdjustmentMode.REMOVE, AdjustmentReason.WRONG_ENTRY, null));
    }

    @Test
    void removalAboveTheLotBalanceIsRejectedWithTheNumbers() {
        InvalidStockRequestException error = assertThrows(InvalidStockRequestException.class,
                () -> AdjustmentRules.requireWithinBalance(20, 12, "Amoxicillin lot L1"));
        assertEquals("Only 12 in Amoxicillin lot L1 — you can't remove 20.", error.getMessage());
        assertDoesNotThrow(() -> AdjustmentRules.requireWithinBalance(12, 12, "Amoxicillin lot L1"));
    }

    @Test
    void quantityMustBePositive() {
        assertThrows(InvalidStockRequestException.class,
                () -> AdjustmentRules.validate(AdjustmentMode.ADD, AdjustmentReason.FOUND_IN_COUNT, null, 0, null, false));
    }

    @Test
    void serialTrackedProductsNeedOneUniqueSerialPerUnit() {
        List<String> serials = List.of("SN1", "SN2");
        assertDoesNotThrow(() -> AdjustmentRules.validate(AdjustmentMode.REMOVE, AdjustmentReason.DAMAGED, null, 2,
                serials, true));
        assertThrows(InvalidStockRequestException.class, () -> AdjustmentRules.validate(AdjustmentMode.REMOVE,
                AdjustmentReason.DAMAGED, null, 3, serials, true));
        assertThrows(InvalidStockRequestException.class, () -> AdjustmentRules.validate(AdjustmentMode.REMOVE,
                AdjustmentReason.DAMAGED, null, 2, List.of("SN1", "SN1"), true));
        assertThrows(InvalidStockRequestException.class, () -> AdjustmentRules.validate(AdjustmentMode.REMOVE,
                AdjustmentReason.DAMAGED, null, 2, null, true));
    }

    @Test
    void serialNumbersAreRefusedForProductsThatAreNotSerialTracked() {
        assertThrows(InvalidStockRequestException.class, () -> AdjustmentRules.validate(AdjustmentMode.REMOVE,
                AdjustmentReason.DAMAGED, null, 1, List.of("SN1"), false));
    }

    @Test
    void reasonsPostAsTheirLedgerMovementType() {
        assertEquals(StockTransactionType.WRITE_OFF, AdjustmentReason.EXPIRED.transactionTypeFor(AdjustmentMode.REMOVE));
        assertEquals(StockTransactionType.ADJUSTMENT_POSITIVE,
                AdjustmentReason.FOUND_IN_COUNT.transactionTypeFor(AdjustmentMode.ADD));
        assertEquals(StockTransactionType.ADJUSTMENT_NEGATIVE,
                AdjustmentReason.WRONG_ENTRY.transactionTypeFor(AdjustmentMode.REMOVE));
        assertEquals(StockTransactionType.ADJUSTMENT_POSITIVE, AdjustmentReason.OTHER.transactionTypeFor(AdjustmentMode.ADD));
    }
}
