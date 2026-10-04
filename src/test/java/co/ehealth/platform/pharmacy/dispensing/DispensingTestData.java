package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Builders shared by the dispensing unit tests.
final class DispensingTestData {

    static final LocalDate TODAY = LocalDate.parse("2026-10-04");
    static final UUID FACILITY_ID = UUID.randomUUID();
    static final UUID PRODUCT_ID = UUID.randomUUID();

    private DispensingTestData() {
    }

    static LotAvailability lot(String lotNumber, String expiry, long available) {
        return new LotAvailability(FACILITY_ID, PRODUCT_ID, UUID.randomUUID(), UUID.randomUUID(), lotNumber,
                expiry == null ? null : LocalDate.parse(expiry), available);
    }

    static StockPicture shelf(LotAvailability... lots) {
        return StockPicture.of(List.of(lots), TODAY);
    }

    static Prescription prescription() {
        Prescription prescription = new Prescription("RX-0000001", UUID.randomUUID(), UUID.randomUUID(),
                FACILITY_ID, UUID.randomUUID(), Instant.parse("2026-10-04T08:00:00Z"));
        ReflectionTestUtils.setField(prescription, "id", UUID.randomUUID());
        return prescription;
    }

    static PrescriptionItem item(Prescription prescription, int quantity, UUID productId) {
        PrescriptionItem item = new PrescriptionItem(prescription.getId(), "Amoxicillin 500mg", "1 tds", quantity);
        ReflectionTestUtils.setField(item, "id", UUID.randomUUID());
        if (productId != null) {
            item.mapToProduct(productId);
        }
        return item;
    }
}
