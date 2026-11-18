package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PatientAllergyProfileRepository extends JpaRepository<PatientAllergyProfile, UUID> {
}