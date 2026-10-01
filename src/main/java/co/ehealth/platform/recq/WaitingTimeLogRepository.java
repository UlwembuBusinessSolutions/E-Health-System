package co.ehealth.platform.recq;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WaitingTimeLogRepository
        extends JpaRepository<WaitingTimeLog, UUID> {

    Optional<WaitingTimeLog> findByVisitId(UUID visitId);

    Optional<WaitingTimeLog> findByPharmacyVisitId(UUID pharmacyVisitId);

    List<WaitingTimeLog>
    findByFacilityIdAndRegistrationStartedAtBetweenOrderByRegistrationStartedAtAsc(
            UUID facilityId,
            Instant from,
            Instant to);

    List<WaitingTimeLog>
    findByRegistrationStartedAtBetweenOrderByRegistrationStartedAtAsc(
            Instant from,
            Instant to);
}