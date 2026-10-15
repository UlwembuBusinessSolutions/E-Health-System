package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PatientGuardianRepository extends JpaRepository<PatientGuardian, UUID> {

    List<PatientGuardian> findByPatientIdOrderByCreatedAtAsc(UUID patientId);

    long countByPatientId(UUID patientId);
}
