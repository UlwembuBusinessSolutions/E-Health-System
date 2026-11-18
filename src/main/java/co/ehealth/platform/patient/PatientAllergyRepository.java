package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PatientAllergyRepository extends JpaRepository<PatientAllergy, UUID> {

    List<PatientAllergy> findByPatientId(UUID patientId);

    // The prescribing guard's query: only active medication allergies can block a medicine.
    List<PatientAllergy> findByPatientIdAndStatusAndAllergenType(UUID patientId, AllergyRecordStatus status,
                                                                  AllergenType allergenType);
}