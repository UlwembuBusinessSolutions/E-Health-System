package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientReferralRepository extends JpaRepository<PatientReferral, UUID> {
    List<PatientReferral> findByPatientIdOrderByReferralDateDescCreatedAtDesc(UUID patientId);
    Optional<PatientReferral> findByIdAndPatientId(UUID id, UUID patientId);
}
