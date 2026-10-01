package co.ehealth.platform.pharmacy;
import co.ehealth.platform.pharmacy.stock.*;
import co.ehealth.platform.identity.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class PrescriptionStockServiceTest {
    PharmacyProductRepository products = mock(PharmacyProductRepository.class);
    PharmacyBatchRepository batches = mock(PharmacyBatchRepository.class);
    PharmacyStockLocationRepository locations = mock(PharmacyStockLocationRepository.class);
    PharmacyStockLedgerService ledger = mock(PharmacyStockLedgerService.class);
    UserRepository users = mock(UserRepository.class);
    co.ehealth.platform.facility.FacilityRepository facilities = mock(co.ehealth.platform.facility.FacilityRepository.class);
    Clock clock = Clock.fixed(Instant.parse("2026-09-28T12:00:00Z"), ZoneOffset.UTC);
    PrescriptionStockService service = new PrescriptionStockService(products, batches, locations, ledger, users, clock, facilities);
    UUID productId = UUID.randomUUID(), batchId = UUID.randomUUID(), locationId = UUID.randomUUID(), actor = UUID.randomUUID();
    Prescription prescription = new Prescription("RX-1", UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), actor, clock.instant());
    PrescriptionItem item = new PrescriptionItem(UUID.randomUUID(), "Tablet", "Daily", 30);
    PharmacyBatch batch = mock(PharmacyBatch.class);
    PharmacyStockLocation location = mock(PharmacyStockLocation.class);
    @BeforeEach void setup() {
        var facility = mock(co.ehealth.platform.facility.Facility.class);
        when(facility.getTimezone()).thenReturn("Africa/Johannesburg");
        when(facilities.findById(prescription.getFacilityId())).thenReturn(Optional.of(facility));
        org.springframework.test.util.ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
        var product = mock(PharmacyProduct.class);
        when(product.getId()).thenReturn(productId); when(product.isActive()).thenReturn(true);
        when(product.getPackSize()).thenReturn(30);
        when(products.findById(productId)).thenReturn(Optional.of(product));
        when(batch.getId()).thenReturn(batchId); when(batch.getProductId()).thenReturn(productId);
        when(batches.findById(batchId)).thenReturn(Optional.of(batch));
        when(location.getId()).thenReturn(locationId); when(location.isActive()).thenReturn(true);
        when(location.getFacilityId()).thenReturn(prescription.getFacilityId());
        when(locations.findById(locationId)).thenReturn(Optional.of(location));
        when(users.findById(actor)).thenReturn(Optional.of(mock(User.class)));
        item.review(productId, ClinicalCheckStatus.PASSED, "Clinical checks passed", actor, clock.instant());
    }
    PrescriptionStockService.DispenseCommand command(int quantity) {
        return new PrescriptionStockService.DispenseCommand(productId,batchId,locationId,quantity);
    }
    @Test void sevenTabletsFromThirtyPackPostsExactlyMinusSeven() {
        service.dispense(prescription,item,actor,command(7));
        var captor = ArgumentCaptor.forClass(List.class);
        verify(ledger).postEntries(eq(StockTransactionType.DISPENSE), eq(prescription.getFacilityId()), eq(actor),
                anyString(), isNull(), eq(prescription.getSerialNumber()), anyString(), matches("[a-f0-9]{64}"), captor.capture());
        var entry = (PharmacyStockLedgerService.EntryRequest) captor.getValue().getFirst();
        assertEquals(-7, entry.quantityDelta()); assertEquals(StockBucket.AVAILABLE,entry.bucket());
        assertEquals(7,item.getDispensedQuantity());
    }
    @Test void unresolvedClinicalReviewCannotBeBypassed() {
        item.review(productId, ClinicalCheckStatus.REVIEW_REQUIRED, "Interaction check required", actor, clock.instant());
        assertThrows(InvalidDispenseException.class, () -> service.dispense(prescription,item,actor,command(7)));
        verifyNoInteractions(ledger); assertEquals(0,item.getDispensedQuantity());
    }
    @Test void reviewedProductCannotBeSubstituted() {
        item.review(UUID.randomUUID(), ClinicalCheckStatus.PASSED, "Checked", actor, clock.instant());
        assertThrows(InvalidDispenseException.class, () -> service.dispense(prescription,item,actor,command(7)));
        verifyNoInteractions(ledger);
    }
    @Test void differentClinicCannotSupplyThisPrescription() {
        when(location.getFacilityId()).thenReturn(UUID.randomUUID());
        assertThrows(InvalidDispenseException.class, () -> service.dispense(prescription,item,actor,command(7)));
        verifyNoInteractions(ledger); assertEquals(0,item.getDispensedQuantity());
    }
    @Test void expiredOrMismatchedBatchIsRejected() {
        when(batch.isExpiredAsOf(any())).thenReturn(true);
        assertThrows(InvalidDispenseException.class, () -> service.dispense(prescription,item,actor,command(7)));
        when(batch.isExpiredAsOf(any())).thenReturn(false);
        when(batch.getProductId()).thenReturn(UUID.randomUUID());
        assertThrows(InvalidDispenseException.class, () -> service.dispense(prescription,item,actor,command(7)));
        verifyNoInteractions(ledger);
    }
}
