package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface DrugSafetyRuleRepository extends JpaRepository<DrugSafetyRule, UUID> {
    List<DrugSafetyRule> findAllByOrderBySeverityDesc();
}
