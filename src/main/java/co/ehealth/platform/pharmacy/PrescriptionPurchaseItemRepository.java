package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PrescriptionPurchaseItemRepository extends JpaRepository<PrescriptionPurchaseItem, UUID> {

    // One query for a whole page of prescriptions, like PrescriptionItemRepository.
    List<PrescriptionPurchaseItem> findByPrescriptionIdIn(Collection<UUID> prescriptionIds);
}
