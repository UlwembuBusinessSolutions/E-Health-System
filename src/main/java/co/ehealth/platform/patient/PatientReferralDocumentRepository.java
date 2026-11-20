package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatientReferralDocumentRepository extends JpaRepository<PatientReferralDocument, UUID> {
    List<PatientReferralDocument> findByReferralIdOrderByUploadedAtDesc(UUID referralId);
    Optional<PatientReferralDocument> findByIdAndReferralIdAndPatientId(UUID id, UUID referralId, UUID patientId);
}
