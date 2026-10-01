package co.ehealth.platform.pharmacy;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
class ClinicalReviewTest {
    @Test void newItemsRequireExplicitClinicalReview() {
        var item = new PrescriptionItem(UUID.randomUUID(), "Tablet", "Daily", 30);
        assertEquals(ClinicalCheckStatus.REVIEW_REQUIRED, item.getClinicalCheckStatus());
        assertNull(item.getProductId()); assertNull(item.getReviewedAt());
        assertThrows(InvalidDispenseException.class, () -> item.review(UUID.randomUUID(), ClinicalCheckStatus.PASSED, " ", UUID.randomUUID(), Instant.now()));
    }
    @Test void reviewRecordsAttributionAndCannotSubstituteAfterSupply() {
        var item = new PrescriptionItem(UUID.randomUUID(), "Tablet", "Daily", 30);
        var product = UUID.randomUUID(); var reviewer = UUID.randomUUID(); var at = Instant.now();
        item.review(product, ClinicalCheckStatus.PASSED, " Checked ", reviewer, at);
        assertEquals(product, item.getProductId()); assertEquals(reviewer, item.getReviewedBy());
        assertEquals(at, item.getReviewedAt()); assertEquals("Checked", item.getClinicalCheckNote());
        item.dispenseQuantity(7);
        assertThrows(InvalidDispenseException.class, () -> item.review(UUID.randomUUID(), ClinicalCheckStatus.PASSED, "Checked", reviewer, at));
        item.review(product, ClinicalCheckStatus.REVIEW_REQUIRED, "Interaction check required", reviewer, at);
        assertEquals(ClinicalCheckStatus.REVIEW_REQUIRED, item.getClinicalCheckStatus());
    }
}
