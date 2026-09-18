package co.ehealth.platform.visit;

// lihle | 2026-09-09 | Aligned visit responses and scoped visit/queue access to the active clinic for connected clinical screens.

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VisitRepository extends JpaRepository<Visit, UUID> {

    List<Visit> findByFacilityIdOrderByVisitDateTimeDesc(UUID facilityId);

    java.util.Optional<Visit> findByIdAndFacilityId(UUID id, UUID facilityId);
}
