package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PrescriptionReturnRepository extends JpaRepository<PrescriptionReturn, UUID> {

    List<PrescriptionReturn> findByPrescriptionItemId(UUID prescriptionItemId);

    List<PrescriptionReturn> findByPrescriptionItemIdIn(Collection<UUID> prescriptionItemIds);
}
