package co.ehealth.platform.visit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface QueueTokenRepository extends JpaRepository<QueueToken, UUID> {

    // QueueService.nextTokenNumber()'s daily-reset-per-facility — counts
    // today's tokens for this facility so far, not a real sequence (this
    // entity's own why-note on that trade-off).
    long countByFacilityIdAndIssuedAtBetween(UUID facilityId, Instant startOfDay, Instant endOfDay);

    // RECQ-US-004's "highest-priority/longest-waiting token ... called" —
    // PRIORITY tokens sort ahead of NORMAL ones via an explicit CASE
    // (not relying on TokenPriority's string ordering to coincidentally
    // sort correctly), ties broken by earliest issue time. Backs both the
    // queue list view and callNext() (which just takes the first result).
    @Query("SELECT qt FROM QueueToken qt WHERE qt.facilityId = :facilityId AND qt.status = 'ISSUED' "
            + "ORDER BY CASE WHEN qt.priority = 'PRIORITY' THEN 0 ELSE 1 END, qt.issuedAt ASC")
    List<QueueToken> findActiveQueue(@Param("facilityId") UUID facilityId);
}
