package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ManualVerificationCaseRepository extends JpaRepository<ManualVerificationCase, UUID> {
    Optional<ManualVerificationCase> findByPrescriptionId(UUID prescriptionId);
    List<ManualVerificationCase> findAllByOrderByCreatedAtAsc();
}
