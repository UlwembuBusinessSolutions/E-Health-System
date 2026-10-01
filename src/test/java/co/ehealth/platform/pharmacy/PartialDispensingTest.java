package co.ehealth.platform.pharmacy;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
class PartialDispensingTest {
    @Test void partialPackAndRemainingSupplyUpdateStatus() {
        var item = new PrescriptionItem(UUID.randomUUID(), "Tablet", "Daily", 30);
        item.dispenseQuantity(7);
        assertEquals(7, item.getDispensedQuantity());
        assertEquals(PrescriptionStatus.PARTIALLY_DISPENSED, item.getStatus());
        var prescription = new Prescription("RX-1", UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), Instant.now());
        prescription.recomputeStatus(List.of(item));
        assertEquals(PrescriptionStatus.PARTIALLY_DISPENSED, prescription.getStatus());
        item.dispenseQuantity(23);
        prescription.recomputeStatus(List.of(item));
        assertEquals(PrescriptionStatus.DISPENSED, prescription.getStatus());
        assertEquals(30, item.getDispensedQuantity());
        assertThrows(InvalidDispenseException.class, () -> item.dispenseQuantity(1));
    }
    @Test void invalidQuantitiesDoNotChangeSuppliedQuantity() {
        var item = new PrescriptionItem(UUID.randomUUID(), "Tablet", "Daily", 30);
        for (int amount : new int[]{0, -1, 31, Integer.MAX_VALUE})
            assertThrows(InvalidDispenseException.class, () -> item.dispenseQuantity(amount));
        assertEquals(0, item.getDispensedQuantity());
        item.dispenseQuantity(7);
        assertThrows(InvalidDispenseException.class, () -> item.dispenseQuantity(24));
        assertEquals(7, item.getDispensedQuantity());
        item.markOutOfStock();
        item.dispenseQuantity(23);
        assertEquals(PrescriptionStatus.DISPENSED, item.getStatus());
    }
}
