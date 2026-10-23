package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PrescriberMessageRepository extends JpaRepository<PrescriberMessage, UUID> {

    // PrescriptionService.getPrescriberMessages() — the pharmacy-facing
    // thread for one prescription, oldest first.
    List<PrescriberMessage> findByPrescriptionIdOrderBySentAtAsc(UUID prescriptionId);
}
