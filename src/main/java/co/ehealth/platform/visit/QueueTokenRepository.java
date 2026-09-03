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
    // callable tokens only (ISSUED), bounded to today so a token nobody
    // resolved on a prior day can't get called into today's queue (this is
    // what makes the queue genuinely "daily," queue-system-improvements.md
    // §1 — a stray ISSUED token simply stops being callable once its day
    // has passed, rather than needing a separate close-out step yet).
    // PRIORITY sorts ahead of NORMAL via an explicit CASE (not relying on
    // TokenPriority's string ordering to coincidentally sort correctly),
    // ties broken by earliest issue time.
    @Query("SELECT qt FROM QueueToken qt WHERE qt.facilityId = :facilityId AND qt.status = 'ISSUED' "
            + "AND qt.issuedAt >= :startOfDay AND qt.issuedAt < :endOfDay "
            + "ORDER BY CASE WHEN qt.priority = 'PRIORITY' THEN 0 ELSE 1 END, qt.issuedAt ASC")
    List<QueueToken> findCallableQueue(@Param("facilityId") UUID facilityId, @Param("startOfDay") Instant startOfDay,
            @Param("endOfDay") Instant endOfDay);

    // The full staff-facing "who's around today" list (RECQ-US-007,
    // queue-system-improvements.md §4) — everyone not yet resolved:
    // currently being served (CALLED) first, then waiting (ISSUED,
    // priority-ordered), then anyone who missed their call and needs a
    // recall (MISSED, oldest miss first, via issuedAt since that's what a
    // recall preserves). COMPLETED/CANCELLED tokens drop off the list
    // entirely once resolved, and nothing from a prior day is included —
    // together that's what keeps this view "daily" rather than an
    // ever-growing history.
    @Query("SELECT qt FROM QueueToken qt WHERE qt.facilityId = :facilityId "
            + "AND qt.status IN ('ISSUED', 'CALLED', 'MISSED') "
            + "AND qt.issuedAt >= :startOfDay AND qt.issuedAt < :endOfDay "
            + "ORDER BY CASE qt.status WHEN 'CALLED' THEN 0 WHEN 'ISSUED' THEN 1 ELSE 2 END, "
            + "CASE WHEN qt.priority = 'PRIORITY' THEN 0 ELSE 1 END, qt.issuedAt ASC")
    List<QueueToken> findTodayQueue(@Param("facilityId") UUID facilityId, @Param("startOfDay") Instant startOfDay,
            @Param("endOfDay") Instant endOfDay);
}
