package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
public class QueueService {

    private final QueueTokenRepository queueTokenRepository;
    private final VisitRepository visitRepository;
    private final PatientService patientService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;
    private final ObjectMapper objectMapper;

    public QueueService(QueueTokenRepository queueTokenRepository, VisitRepository visitRepository,
                         PatientService patientService, AuditLogService auditLogService, Clock clock,
                         PermissionService permissionService, ObjectMapper objectMapper) {
        this.queueTokenRepository = queueTokenRepository;
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
        this.objectMapper = objectMapper;
    }

    // RECQ-US-001's automatic path — VisitService.createVisit() calls this
    // in the same transaction as the Visit it just created, "Visit w/ valid
    // MPI -> token issued" being one atomic hand-off rather than two
    // separate client calls. Not manual, always NORMAL priority: nothing
    // about a fresh visit implies urgency yet, unlike a receptionist
    // deliberately flagging one via issueManualToken() below.
    QueueToken issueAutomaticToken(Visit visit, UUID issuedByUserId) {
        return issue(visit, TokenPriority.NORMAL, false, issuedByUserId);
    }

    // RECQ-US-002 — "User w/ queue-mgmt permission issues manual token,
    // same structure, flagged manual for reporting." Takes an existing
    // visitId rather than creating one: this is for re-queuing or a
    // priority override on a visit that already has (or previously had) a
    // token, not an alternate patient-intake path.
    @Transactional
    public QueueToken issueManualToken(UUID visitId, TokenPriority priority, UUID issuedByUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        return issue(visit, priority, true, issuedByUserId);
    }

    private QueueToken issue(Visit visit, TokenPriority priority, boolean manual, UUID issuedByUserId) {
        Instant now = clock.instant();
        int tokenNumber = nextTokenNumber(visit.getFacilityId(), now);
        QueueToken token = new QueueToken(visit.getId(), visit.getFacilityId(), tokenNumber, priority, manual,
                now, issuedByUserId);
        queueTokenRepository.save(token);
        auditLogService.append(issuedByUserId, visit.getFacilityId(),
                manual ? "QUEUE_TOKEN_ISSUED_MANUAL" : "QUEUE_TOKEN_ISSUED", "QueueToken", token.getId().toString(),
                null, null);
        return token;
    }

    // RECQ-US-001's "numbering resets daily per station" — this codebase
    // has no Station entity yet (RECQ-US-012, Sprint 4), so "per facility"
    // stands in for it. A plain count-then-increment, not a Postgres
    // sequence: a real sequence can't reset at midnight without extra
    // scheduled maintenance, which is more machinery than a reception
    // desk's daily token count needs at this scale — the small race window
    // under truly simultaneous issuance at the same facility is an accepted
    // trade-off here, unlike PatientService's MPI generation which
    // genuinely needs sequence-level concurrency safety (an MPI collision
    // would corrupt patient identity; a skipped/duplicate queue number
    // just means someone re-prints a ticket).
    private int nextTokenNumber(UUID facilityId, Instant now) {
        DayBounds bounds = dayBounds(now);
        long issuedToday = queueTokenRepository.countByFacilityIdAndIssuedAtBetween(facilityId, bounds.startOfDay(),
                bounds.startOfNextDay());
        return (int) issuedToday + 1;
    }

    // One definition of "today" (UTC) shared by numbering, the callable
    // queue, and the full daily list — used to keep those three from
    // silently drifting apart, not because any of them has a stronger
    // timezone requirement than nextTokenNumber() already had.
    private static DayBounds dayBounds(Instant now) {
        LocalDate today = now.atZone(ZoneOffset.UTC).toLocalDate();
        Instant startOfDay = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant startOfNextDay = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return new DayBounds(startOfDay, startOfNextDay);
    }

    private record DayBounds(Instant startOfDay, Instant startOfNextDay) {
    }

    // RECQ-US-011's "live queue" read, minus the push-refresh (Sprint 4,
    // out of scope) — a plain GET is enough to prove the ordering
    // (currently-served, then priority, then earliest issued) is right.
    // Scoped to today (queue-system-improvements.md §1) and, with `search`,
    // filtered by token number / patient name / MPI (RECQ-US-007) — applied
    // in memory after enrichment rather than in SQL, matching this method's
    // existing "accepted N+1" trade-off below: a single facility's daily
    // queue is realistically a handful of people, not a scale where either
    // the N+1 lookup or an in-memory filter matters yet.
    public List<QueueEntryView> listActiveQueueView(UUID facilityId, String search) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        DayBounds bounds = dayBounds(clock.instant());
        List<QueueEntryView> views = queueTokenRepository
                .findTodayQueue(facilityId, bounds.startOfDay(), bounds.startOfNextDay()).stream().map(this::toView)
                .toList();
        if (!StringUtils.hasText(search)) {
            return views;
        }
        String needle = search.trim().toLowerCase();
        return views.stream().filter(v -> matchesSearch(v, needle)).toList();
    }

    private boolean matchesSearch(QueueEntryView view, String needle) {
        return String.valueOf(view.token().getTokenNumber()).contains(needle)
                || view.patientName().toLowerCase().contains(needle)
                || view.patientMpi().toLowerCase().contains(needle);
    }

    private QueueEntryView toView(QueueToken token) {
        Visit visit = visitRepository.findById(token.getVisitId()).orElseThrow(VisitNotFoundException::new);
        Patient patient = patientService.get(visit.getPatientId());
        return new QueueEntryView(token, patient.getFirstName() + " " + patient.getLastName(),
                patient.getMpiNumber());
    }

    public record QueueEntryView(QueueToken token, String patientName, String patientMpi) {
    }

    // RECQ-US-004 — "the highest-priority/longest-waiting token for the
    // station is called." findCallableQueue() already returns the queue in
    // exactly that order (bounded to today); calling next is just taking
    // its head.
    @Transactional
    public QueueEntryView callNext(UUID facilityId, UUID calledByUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        Instant now = clock.instant();
        DayBounds bounds = dayBounds(now);
        List<QueueToken> queue =
                queueTokenRepository.findCallableQueue(facilityId, bounds.startOfDay(), bounds.startOfNextDay());
        if (queue.isEmpty()) {
            throw new EmptyQueueException();
        }
        QueueToken next = queue.get(0);
        next.call(now);
        queueTokenRepository.save(next);
        auditLogService.append(calledByUserId, facilityId, "QUEUE_TOKEN_CALLED", "QueueToken",
                next.getId().toString(), null, null);
        return toView(next);
    }

    // The out-and-back scenario, step one: a nurse/marshall flags a called
    // token as MISSED when the patient doesn't respond, instead of it
    // silently sitting as CALLED forever (queue-appointments-plan.md
    // §3.8). No automated timeout yet — a deliberate scope cut, see
    // queue-system-improvements.md §3.
    @Transactional
    public QueueEntryView markMissed(UUID tokenId, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        QueueToken token = findToken(tokenId);
        token.markMissed(clock.instant());
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_MISSED", "QueueToken",
                token.getId().toString(), null, null);
        return toView(token);
    }

    // Step two: the patient is back. Recall re-inserts the token as ISSUED
    // with its original priority and issuedAt untouched — the whole point
    // being that stepping out doesn't cost them their place to people who
    // arrived after them.
    @Transactional
    public QueueEntryView recall(UUID tokenId, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        QueueToken token = findToken(tokenId);
        token.recall();
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_RECALLED", "QueueToken",
                token.getId().toString(), null, null);
        return toView(token);
    }

    // RECQ-US-005 — service finished; the token leaves the active/daily
    // list for good.
    @Transactional
    public QueueEntryView complete(UUID tokenId, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        QueueToken token = findToken(tokenId);
        token.complete(clock.instant());
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_COMPLETED", "QueueToken",
                token.getId().toString(), null, null);
        return toView(token);
    }

    // RECQ-US-005 — cancellable from ISSUED, CALLED, or MISSED; the reason
    // is mandatory (validated at the controller) and stored on the token
    // itself as well as the audit trail, so "why was this cancelled" never
    // depends on cross-referencing the log separately.
    @Transactional
    public QueueEntryView cancel(UUID tokenId, String reason, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        QueueToken token = findToken(tokenId);
        token.cancel(clock.instant(), reason, staffUserId);
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_CANCELLED", "QueueToken",
                token.getId().toString(), null, serializeCancelReason(reason));
        return toView(token);
    }

    private QueueToken findToken(UUID tokenId) {
        return queueTokenRepository.findById(tokenId).orElseThrow(QueueTokenNotFoundException::new);
    }

    // audit_log.after_value is jsonb (AuthService.serializeLoginState()'s
    // own why-note) — a raw plain-text reason would fail the insert with
    // "invalid input syntax for type json", not silently truncate. Same
    // swallow-on-failure fallback as that method: a malformed audit detail
    // shouldn't block the cancellation itself.
    private String serializeCancelReason(String reason) {
        try {
            return objectMapper.writeValueAsString(new CancelReasonSnapshot(reason));
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private record CancelReasonSnapshot(String reason) {
    }
}
