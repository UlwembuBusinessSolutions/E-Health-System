package co.ehealth.platform.visit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
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

    // QueueService.callNext()'s actual claim — deliberately separate from
    // findCallableQueue() above, which is a plain, unlocked read (fine for
    // "is this token in today's callable list" checks and for the display
    // list, but not safe as the basis for a write). Without row locking,
    // two concurrent "call next" requests (two reception counters clicking
    // at once) can both read the same head-of-queue token before either
    // commits its UPDATE, and both end up calling the same patient to two
    // different counters while the next person in line gets skipped this
    // round entirely — a real race, not a hypothetical one, and exactly
    // the "two simultaneous call-next requests never return the same
    // token" guarantee this queue needs. `FOR UPDATE SKIP LOCKED` is
    // Postgres's standard safe-queue-claim idiom: a concurrent transaction
    // already holding a lock on a row has that row excluded from this
    // SELECT rather than blocking on it, so two concurrent callers claim
    // two different tokens instead of one blocking behind the other for no
    // reason (and, unlike a bare row lock, never contend over rows neither
    // of them is even trying to claim). A native query, not JPQL — Spring
    // Data JPA's @Lock only reaches plain `FOR UPDATE`, with no portable
    // way to add SKIP LOCKED, so this is hand-written SQL against the
    // actual queue_tokens columns; `SELECT *` hydrates the entity because
    // the projection is exactly the columns QueueToken already maps.
    @Query(value = "SELECT * FROM queue_tokens WHERE facility_id = :facilityId AND status = 'ISSUED' "
            + "AND issued_at >= :startOfDay AND issued_at < :endOfDay "
            + "ORDER BY CASE WHEN priority = 'PRIORITY' THEN 0 ELSE 1 END, issued_at ASC "
            + "LIMIT 1 FOR UPDATE SKIP LOCKED", nativeQuery = true)
    Optional<QueueToken> claimNextCallable(@Param("facilityId") UUID facilityId,
            @Param("startOfDay") Instant startOfDay, @Param("endOfDay") Instant endOfDay);

    // The full staff-facing "who's around today" list (RECQ-US-007,
    // queue-system-improvements.md §4) — every status for the day,
    // unfiltered here; QueueService.listQueueView() applies the caller's
    // status/priority/search filters afterward (its own default view sends
    // ISSUED/CALLED/MISSED, which is what actually keeps COMPLETED/
    // CANCELLED out of the everyday list — this query alone does not).
    // Ordered currently-being-served (CALLED) first, then waiting (ISSUED,
    // priority-ordered), then everything else. Nothing from a prior day is
    // included — that's what keeps this view "daily" rather than an
    // ever-growing history.
    @Query("SELECT qt FROM QueueToken qt WHERE qt.facilityId = :facilityId "
            + "AND qt.issuedAt >= :startOfDay AND qt.issuedAt < :endOfDay "
            + "ORDER BY CASE qt.status WHEN 'CALLED' THEN 0 WHEN 'ISSUED' THEN 1 ELSE 2 END, "
            + "CASE WHEN qt.priority = 'PRIORITY' THEN 0 ELSE 1 END, qt.issuedAt ASC")
    List<QueueToken> findFacilityDayQueue(@Param("facilityId") UUID facilityId, @Param("startOfDay") Instant startOfDay,
            @Param("endOfDay") Instant endOfDay);

    // QueueService.transferVisitToFacility() — there's no other caller that
    // needs "the" token for a visit rather than a facility's whole day, so
    // this is the one place that looks a token up this way. A visit
    // normally has exactly one token for its whole life (recall mutates the
    // same row rather than issuing a new one); ordering by issuedAt desc is
    // just a safety margin for the rare case of more than one.
    Optional<QueueToken> findFirstByVisitIdOrderByIssuedAtDesc(UUID visitId);
}
