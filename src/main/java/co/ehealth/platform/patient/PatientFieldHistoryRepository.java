package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PatientFieldHistoryRepository extends JpaRepository<PatientFieldHistory, UUID> {

    List<PatientFieldHistory> findByPatientIdOrderByChangedAtDesc(UUID patientId);
}
