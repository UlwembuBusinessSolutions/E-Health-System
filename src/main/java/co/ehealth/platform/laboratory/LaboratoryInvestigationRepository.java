package co.ehealth.platform.laboratory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LaboratoryInvestigationRepository extends JpaRepository<LaboratoryInvestigation, UUID> {

    List<LaboratoryInvestigation> findByVisitIdOrderByInvestigationDateDescCreatedAtDesc(UUID visitId);
}
