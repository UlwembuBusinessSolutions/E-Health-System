package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    public QueueService(QueueTokenRepository queueTokenRepository, VisitRepository visitRepository,
            PatientService patientService, AuditLogService auditLogService, Clock clock,
            PermissionService permissionService) {
        this.queueTokenRepository = queueTokenRepository;
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
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
        LocalDate today = now.atZone(ZoneOffset.UTC).toLocalDate();
        Instant startOfDay = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant startOfNextDay = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        long issuedToday = queueTokenRepository.countByFacilityIdAndIssuedAtBetween(facilityId, startOfDay,
                startOfNextDay);
        return (int) issuedToday + 1;
    }

    // RECQ-US-011's "live queue" read, minus the push-refresh (Sprint 4,
    // out of scope) — a plain GET is enough to prove the ordering
    // (priority, then earliest issued) is right. Enriched with the
    // patient's name: this is the staff-facing queue view (RECQ-US-007's
    // "search ... by token number, patient name or MPI"), not the
    // public waiting-room display RECQ-US-011 separately specifies as
    // "token numbers only, no names" — that's a different, unbuilt
    // endpoint, not this one. One lookup per token rather than a bulk
    // fetch: an active queue at a single facility is realistically a
    // handful of people, not a scale where N+1 here matters yet.
    public List<QueueEntryView> listActiveQueueView(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        return queueTokenRepository.findActiveQueue(facilityId).stream().map(this::toView).toList();
    }

    // private QueueEntryView toView(QueueToken token) {
    // Visit visit =
    // visitRepository.findById(token.getVisitId()).orElseThrow(VisitNotFoundException::new);
    // Patient patient = patientService.get(visit.getPatientId());
    // return new QueueEntryView(token, patient.getFirstName() + " " +
    // patient.getLastName(),
    // patient.getMpiNumber());
    // }

    // public record QueueEntryView(QueueToken token, String patientName, String
    // patientMpi) {
    // }

    public record QueueEntryView(QueueToken token, String patientName, String patientMpi, ServiceStream serviceStream) {
    }

    private QueueEntryView toView(QueueToken token) {
        Visit visit = visitRepository.findById(token.getVisitId()).orElseThrow(VisitNotFoundException::new);
        Patient patient = patientService.get(visit.getPatientId());

        return new QueueEntryView(token, patient.getFirstName() + " " + patient.getLastName(),
                patient.getMpiNumber(), visit.getServiceStream());
    }

    // RECQ-US-004 — "the highest-priority/longest-waiting token for the
    // station is called." findActiveQueue() already returns the queue in
    // exactly that order; calling next is just taking its head.
    @Transactional
    public QueueEntryView callNext(UUID facilityId, UUID calledByUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        List<QueueToken> queue = queueTokenRepository.findActiveQueue(facilityId);
        if (queue.isEmpty()) {
            throw new EmptyQueueException();
        }
        QueueToken next = queue.get(0);
        next.call(clock.instant());
        queueTokenRepository.save(next);
        auditLogService.append(calledByUserId, facilityId, "QUEUE_TOKEN_CALLED", "QueueToken",
                next.getId().toString(), null, null);
        return toView(next);
    }
}
