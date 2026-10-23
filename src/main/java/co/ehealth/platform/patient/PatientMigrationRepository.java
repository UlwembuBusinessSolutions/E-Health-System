package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PatientMigrationRepository extends JpaRepository<PatientMigration, UUID> {

    Optional<PatientMigration> findByPatientId(UUID patientId);

    boolean existsByPatientId(UUID patientId);
}
