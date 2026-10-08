package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.PrescriptionRepository;
import org.springframework.stereotype.Component;

// A prescription's status is never set directly; it is recomputed from its
// items after every item-level action (Prescription.recomputeStatus()).
@Component
public class PrescriptionRollup {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository itemRepository;

    public PrescriptionRollup(PrescriptionRepository prescriptionRepository,
                               PrescriptionItemRepository itemRepository) {
        this.prescriptionRepository = prescriptionRepository;
        this.itemRepository = itemRepository;
    }

    public void refresh(Prescription prescription) {
        prescription.recomputeStatus(itemRepository.findByPrescriptionId(prescription.getId()));
        prescriptionRepository.save(prescription);
    }
}
