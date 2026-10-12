package co.ehealth.platform.pharmacy.purchasing;

import co.ehealth.platform.pharmacy.purchasing.PurchaseOrderRules.LineDraft;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PurchaseOrderRulesTest {

    private LineDraft line(UUID productId, int packs, int packSize, int quantity) {
        return new LineDraft(productId, packs, packSize, quantity);
    }

    @Test
    void quantityEqualToPacksTimesPackSizeIsAccepted() {
        assertDoesNotThrow(() -> PurchaseOrderRules.requireValidLines(
                List.of(line(UUID.randomUUID(), 3, 30, 90), line(UUID.randomUUID(), 1, 1, 1))));
    }

    @Test
    void quantityThatDoesNotMatchPacksTimesPackSizeIsRefusedWithTheSum() {
        PharmacyValidationException refusal = assertThrows(PharmacyValidationException.class,
                () -> PurchaseOrderRules.requireValidLines(List.of(line(UUID.randomUUID(), 3, 30, 80))));

        assertTrue(refusal.getMessage().contains("3 x 30 = 90"));
    }

    @Test
    void packsAndPackSizeMustEachBeAtLeastOne() {
        assertThrows(PharmacyValidationException.class,
                () -> PurchaseOrderRules.requireValidLines(List.of(line(UUID.randomUUID(), 0, 30, 0))));
        assertThrows(PharmacyValidationException.class,
                () -> PurchaseOrderRules.requireValidLines(List.of(line(UUID.randomUUID(), 2, 0, 0))));
    }

    @Test
    void hugeFiguresThatWrapAroundToTheSameQuantityAreStillRefused() {
        int packs = 65_536;
        int packSize = 65_536;

        assertThrows(PharmacyValidationException.class,
                () -> PurchaseOrderRules.requireValidLines(List.of(line(UUID.randomUUID(), packs, packSize, 0))));
    }

    @Test
    void anOrderNeedsAtLeastOneLine() {
        assertThrows(PharmacyValidationException.class, () -> PurchaseOrderRules.requireValidLines(List.of()));
    }

    @Test
    void aProductCannotAppearTwice() {
        UUID productId = UUID.randomUUID();

        assertThrows(PharmacyValidationException.class, () -> PurchaseOrderRules
                .requireValidLines(List.of(line(productId, 1, 10, 10), line(productId, 2, 10, 20))));
    }
}
