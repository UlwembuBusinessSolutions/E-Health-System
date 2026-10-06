package co.ehealth.platform.consultation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ConsultationDiagnosisRepository extends JpaRepository<ConsultationDiagnosis, UUID> {

    List<ConsultationDiagnosis> findByConsultationIdOrderBySortOrderAsc(UUID consultationId);

    // ConsultationService.addDiagnosis()'s next sortOrder value.
    int countByConsultationId(UUID consultationId);
}
