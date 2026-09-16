package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PatientClinicalFactRepository extends JpaRepository<PatientClinicalFact, UUID> {
    List<PatientClinicalFact> findByPatientId(UUID patientId);
    boolean existsByPatientIdAndTypeAndTermIgnoreCase(UUID patientId, PatientClinicalFact.Type type, String term);
}
