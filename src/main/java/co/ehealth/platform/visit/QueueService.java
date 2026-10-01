package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class QueueService {

    private final QueueTokenRepository queueTokenRepository;
    private final QueueTokenEventRepository queueTokenEventRepository;
    private final VisitRepository visitRepository;
    private final PatientService patientService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;
    private final FacilityRepository facilityRepository;

    public QueueService(QueueTokenRepository queueTokenRepository,
                         QueueTokenEventRepository queueTokenEventRepository, VisitRepository visitRepository,
                         PatientService patientService, AuditLogService auditLogService, Clock clock,
                         PermissionService permissionService, FacilityRepository facilityRepository) {
        this.queueTokenRepository = queueTokenRepository;
        this.queueTokenEventRepository = queueTokenEventRepository;
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
        this.facilityRepository = facilityRepository;
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
        return issue(visit, priority, manual, issuedByUserId, QueueTokenEventType.ISSUED, null);
    }

    // transferToken()'s destination-side issuance — same status transition
    // (null -> ISSUED) as any other issue(), but tagged TRANSFERRED_IN and
    // carrying a reasonNote pointing back at the origin token, same
    // "distinct event type for the same transition" pattern as
    // CALLED_OUT_OF_ORDER vs CALLED.
    private QueueToken issue(Visit visit, TokenPriority priority, boolean manual, UUID issuedByUserId,
                              QueueTokenEventType eventType, String reasonNote) {
        Instant now = clock.instant();
        int tokenNumber = nextTokenNumber(visit.getFacilityId(), now);
        QueueToken token = new QueueToken(visit.getId(), visit.getFacilityId(), tokenNumber, priority, manual,
                now, issuedByUserId);
        queueTokenRepository.save(token);
        auditLogService.append(issuedByUserId, visit.getFacilityId(),
                manual ? "QUEUE_TOKEN_ISSUED_MANUAL" : "QUEUE_TOKEN_ISSUED", "QueueToken", token.getId().toString(),
                null, null);
        recordEvent(token.getId(), eventType, null, TokenStatus.ISSUED, null, null, null, reasonNote,
                issuedByUserId, now);
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
        DayBounds bounds = dayBounds(facilityId, now.atZone(facilityZone(facilityId)).toLocalDate());
        long issuedToday = queueTokenRepository.countByFacilityIdAndIssuedAtBetween(facilityId, bounds.startOfDay(),
                bounds.startOfNextDay());
        return (int) issuedToday + 1;
    }

    // One definition of "today" (UTC) shared by numbering, the callable
    // queue, and the full daily list — used to keep those three from
    // silently drifting apart, not because any of them has a stronger
    // timezone requirement than nextTokenNumber() already had.
    private DayBounds dayBounds(UUID facilityId, LocalDate date) {
        ZoneId zone = facilityZone(facilityId);
        Instant startOfDay = date.atStartOfDay(zone).toInstant();
        Instant startOfNextDay = date.plusDays(1).atStartOfDay(zone).toInstant();
        return new DayBounds(startOfDay, startOfNextDay);
    }

    private ZoneId facilityZone(UUID facilityId) {
        String timezone = facilityRepository.findById(facilityId).orElseThrow(FacilityNotFoundException::new)
                .getTimezone();
        return ZoneId.of(timezone);
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
    public QueuePageView listQueueView(UUID facilityId, String search, Set<TokenStatus> statuses,
                                        TokenPriority priority, LocalDate date, int page, int pageSize) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        LocalDate selectedDate = date != null ? date : clock.instant().atZone(facilityZone(facilityId)).toLocalDate();
        DayBounds bounds = dayBounds(facilityId, selectedDate);
        List<QueueEntryView> views = queueTokenRepository
                .findFacilityDayQueue(facilityId, bounds.startOfDay(), bounds.startOfNextDay()).stream().map(this::toView)
                .toList();
        if (statuses != null && !statuses.isEmpty()) {
            views = views.stream().filter(v -> statuses.contains(v.token().getStatus())).toList();
        }
        if (priority != null) {
            views = views.stream().filter(v -> v.token().getPriority() == priority).toList();
        }
        if (StringUtils.hasText(search)) {
            String needle = search.trim().toLowerCase();
            views = views.stream().filter(v -> matchesSearch(v, needle)).toList();
        }
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(pageSize, 1), 100);
        int totalElements = views.size();
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);
        int from = Math.min(safePage * safeSize, totalElements);
        int to = Math.min(from + safeSize, totalElements);
        return new QueuePageView(views.subList(from, to), safePage, safeSize, totalElements, totalPages, selectedDate);
    }

    private boolean matchesSearch(QueueEntryView view, String needle) {
        return String.valueOf(view.token().getTokenNumber()).contains(needle)
                || view.patientName().toLowerCase().contains(needle)
                || view.patientMpi().toLowerCase().contains(needle);
    }

    private QueueEntryView toView(QueueToken token) {
        Visit visit = visitRepository.findById(token.getVisitId()).orElseThrow(VisitNotFoundException::new);
        Patient patient = patientService.get(visit.getPatientId());
        return new QueueEntryView(token, patient.getId(), patient.getFirstName() + " " + patient.getLastName(),
                patient.getMpiNumber());
    }

    // patientId — not previously exposed here — is what lets the queue
    // page's "Vitals" action link straight to a patient's page (and that
    // patient's specific visit) without the caller having to search for
    // them by name mid-workflow.
    public record QueueEntryView(QueueToken token, UUID patientId, String patientName, String patientMpi) {
    }

    public record QueuePageView(List<QueueEntryView> items, int page, int pageSize, int totalElements,
                                int totalPages, LocalDate date) {
    }

    // RECQ-US-003's ticket print/reprint and a future "what happened to
    // this ticket" view — the normalized event history (V21) for one
    // token, oldest first.
    public List<QueueTokenEvent> getTokenHistory(UUID tokenId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        findToken(tokenId);
        return queueTokenEventRepository.findByTokenIdOrderByOccurredAtAsc(tokenId);
    }

    // RECQ-US-004 — "the highest-priority/longest-waiting token for the
    // station is called." findCallableQueue() already returns the queue in
    // exactly that order (bounded to today); calling next is just taking
    // its head.
    @Transactional
    public QueueEntryView callNext(UUID facilityId, UUID calledByUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        Instant now = clock.instant();
        DayBounds bounds = dayBounds(facilityId, now.atZone(facilityZone(facilityId)).toLocalDate());
        QueueToken next = queueTokenRepository
                .claimNextCallable(facilityId, bounds.startOfDay(), bounds.startOfNextDay())
                .orElseThrow(EmptyQueueException::new);
        next.call(now);
        queueTokenRepository.save(next);
        auditLogService.append(calledByUserId, facilityId, "QUEUE_TOKEN_CALLED", "QueueToken",
                next.getId().toString(), null, null);
        recordEvent(next.getId(), QueueTokenEventType.CALLED, TokenStatus.ISSUED, TokenStatus.CALLED, null, null,
                null, null, calledByUserId, now);
        return toView(next);
    }

    // Boosting (or demoting) priority in place — the fix for a real bug:
    // this used to be done by calling issueManualToken() again against the
    // same visit, which issues a genuinely new token/token-number rather
    // than changing the existing one. That left the original token sitting
    // in today's list untouched, so boosting a waiting patient produced two
    // visible rows for them instead of moving the one row up the queue.
    // This mutates the existing token's priority only — no new token, no
    // change to issuedAt or status.
    @Transactional
    public QueueEntryView updatePriority(UUID tokenId, TokenPriority priority, QueueActionReason reasonCode,
                                         String reasonNote, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        validateReason(reasonCode, reasonNote);
        QueueToken token = findToken(tokenId);
        TokenPriority previous = token.getPriority();
        token.updatePriority(priority);
        queueTokenRepository.save(token);
        Instant now = clock.instant();
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_PRIORITY_UPDATED", "QueueToken",
                token.getId().toString(), null, null);
        recordEvent(token.getId(), QueueTokenEventType.PRIORITY_CHANGED, token.getStatus(), token.getStatus(),
                previous, priority, reasonCode, reasonNote, staffUserId, now);
        return toView(token);
    }

    @Transactional
    public QueueEntryView callToken(UUID tokenId, QueueActionReason reasonCode, String reasonNote, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        QueueToken token = findToken(tokenId);
        Instant now = clock.instant();
        DayBounds bounds = dayBounds(token.getFacilityId(), now.atZone(facilityZone(token.getFacilityId())).toLocalDate());
        List<QueueToken> callable = queueTokenRepository.findCallableQueue(token.getFacilityId(), bounds.startOfDay(),
                bounds.startOfNextDay());
        if (callable.isEmpty() || callable.stream().noneMatch(candidate -> candidate.getId().equals(tokenId))) {
            throw new InvalidTokenTransitionException(token.getStatus(), TokenStatus.CALLED);
        }
        boolean bypassedOrder = !callable.get(0).getId().equals(tokenId);
        if (bypassedOrder) {
            validateReason(reasonCode, reasonNote);
        }
        token.call(now);
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(),
                bypassedOrder ? "QUEUE_TOKEN_CALLED_OUT_OF_ORDER" : "QUEUE_TOKEN_CALLED", "QueueToken",
                token.getId().toString(), null, null);
        recordEvent(token.getId(),
                bypassedOrder ? QueueTokenEventType.CALLED_OUT_OF_ORDER : QueueTokenEventType.CALLED,
                TokenStatus.ISSUED, TokenStatus.CALLED, null, null, bypassedOrder ? reasonCode : null,
                bypassedOrder ? reasonNote : null, staffUserId, now);
        return toView(token);
    }

    @Transactional
    public QueueEntryView reactivate(UUID tokenId, QueueActionReason reasonCode, String reasonNote, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        validateReason(reasonCode, reasonNote);
        QueueToken token = findToken(tokenId);
        LocalDate today = clock.instant().atZone(facilityZone(token.getFacilityId())).toLocalDate();
        LocalDate issuedDate = token.getIssuedAt().atZone(facilityZone(token.getFacilityId())).toLocalDate();
        if (!issuedDate.equals(today)) {
            throw new InvalidTokenTransitionException(token.getStatus(), TokenStatus.ISSUED);
        }
        TokenStatus previousStatus = token.getStatus();
        token.reactivate();
        queueTokenRepository.save(token);
        Instant now = clock.instant();
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_REACTIVATED", "QueueToken",
                token.getId().toString(), null, null);
        recordEvent(token.getId(), QueueTokenEventType.REACTIVATED, previousStatus, TokenStatus.ISSUED, null, null,
                reasonCode, reasonNote, staffUserId, now);
        return toView(token);
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
        Instant now = clock.instant();
        token.markMissed(now);
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_MISSED", "QueueToken",
                token.getId().toString(), null, null);
        recordEvent(token.getId(), QueueTokenEventType.MISSED, TokenStatus.CALLED, TokenStatus.MISSED, null, null,
                null, null, staffUserId, now);
        return toView(token);
    }

    // RECQ-US-005 — service finished; the token leaves the active/daily
    // list for good.
    @Transactional
    public QueueEntryView complete(UUID tokenId, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        QueueToken token = findToken(tokenId);
        Instant now = clock.instant();
        token.complete(now);
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_COMPLETED", "QueueToken",
                token.getId().toString(), null, null);
        recordEvent(token.getId(), QueueTokenEventType.COMPLETED, TokenStatus.CALLED, TokenStatus.COMPLETED, null,
                null, null, null, staffUserId, now);
        return toView(token);
    }

    // RECQ-US-005 — cancellable from ISSUED, CALLED, or MISSED; the reason
    // is mandatory (validated at the controller) and stored on the token
    // itself (current-episode snapshot, cancel_reason) as well as this
    // token's own event history — never as a JSON blob shoved into the
    // generic audit_log the way this used to work (a real bug: audit_log's
    // before/after_value are jsonb, and a raw string there failed the
    // insert outright). The properly normalized event row replaces that
    // workaround entirely.
    @Transactional
    public QueueEntryView cancel(UUID tokenId, String reason, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        QueueToken token = findToken(tokenId);
        TokenStatus previousStatus = token.getStatus();
        Instant now = clock.instant();
        token.cancel(now, reason, staffUserId);
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_CANCELLED", "QueueToken",
                token.getId().toString(), null, null);
        recordEvent(token.getId(), QueueTokenEventType.CANCELLED, previousStatus, TokenStatus.CANCELLED, null, null,
                null, reason, staffUserId, now);
        return toView(token);
    }

    // A cross-facility transfer, not a new status: reuses cancel()'s exact
    // guard (ISSUED, CALLED, or MISSED — terminal tokens can't be
    // transferred any more than they can be cancelled) rather than teaching
    // QueueToken a new transition, since "this token is done, a new one
    // exists elsewhere" is exactly what cancel-and-reissue already means.
    // The destination gets a genuinely new Visit (Visit.facilityId is
    // immutable, and QueueToken.facilityId is denormalized from it — see
    // both entities' own why-notes) linked back via
    // Visit.transferredFromVisitId, and a fresh token/token-number in the
    // destination facility's own daily sequence.
    @Transactional
    public QueueEntryView transferToken(UUID tokenId, UUID destinationFacilityId, String reason, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        QueueToken token = findToken(tokenId);
        if (destinationFacilityId.equals(token.getFacilityId())) {
            throw new InvalidTransferException();
        }
        var destinationFacility = facilityRepository.findById(destinationFacilityId)
                .orElseThrow(FacilityNotFoundException::new);
        Visit originVisit = visitRepository.findById(token.getVisitId()).orElseThrow(VisitNotFoundException::new);

        TokenStatus previousStatus = token.getStatus();
        Instant now = clock.instant();
        String cancelReason = "Transferred to " + destinationFacility.getName()
                + (StringUtils.hasText(reason) ? ": " + reason : "");
        token.cancel(now, cancelReason, staffUserId);
        queueTokenRepository.save(token);
        auditLogService.append(staffUserId, token.getFacilityId(), "QUEUE_TOKEN_TRANSFERRED_OUT", "QueueToken",
                token.getId().toString(), null, null);
        recordEvent(token.getId(), QueueTokenEventType.TRANSFERRED_OUT, previousStatus, TokenStatus.CANCELLED, null,
                null, null, cancelReason, staffUserId, now);

        Visit destinationVisit = new Visit(originVisit.getPatientId(), destinationFacilityId,
                originVisit.getVisitType(), originVisit.getServiceStream(), now, staffUserId, originVisit.getId());
        visitRepository.save(destinationVisit);
        QueueToken newToken = issue(destinationVisit, token.getPriority(), true, staffUserId,
                QueueTokenEventType.TRANSFERRED_IN, "Transferred from token #" + token.getTokenNumber());
        auditLogService.append(staffUserId, destinationFacilityId, "QUEUE_TOKEN_TRANSFERRED_IN", "QueueToken",
                newToken.getId().toString(), null, null);

        return toView(newToken);
    }

    // ConsultationService.sign()'s "Send to pharmacy" outcome — resolves
    // whichever token belongs to this visit (there's no visitId index on
    // the everyday facility/day-scoped queue queries, see
    // QueueTokenRepository's own why-note) and delegates to transferToken()
    // above, the same cross-facility transfer staff already use manually
    // from a visible queue row. An already-terminal token (already
    // completed/cancelled/transferred) fails here exactly the way a
    // staff-initiated transfer of a terminal token already would —
    // QueueToken.cancel()'s own transition guard, not a separate check.
    @Transactional
    public QueueEntryView transferVisitToFacility(UUID visitId, UUID destinationFacilityId, String reason,
                                                   UUID staffUserId) {
        QueueToken token = queueTokenRepository.findFirstByVisitIdOrderByIssuedAtDesc(visitId)
                .orElseThrow(QueueTokenNotFoundException::new);
        return transferToken(token.getId(), destinationFacilityId, reason, staffUserId);
    }

    private QueueToken findToken(UUID tokenId) {
        return queueTokenRepository.findById(tokenId).orElseThrow(QueueTokenNotFoundException::new);
    }

    // RECQ-US-003's ticket print/reprint — the queue page's "Print" button
    // and the "Visit started" success screen both need to fetch one
    // specific token's full details (patient name/MPI included) by id, not
    // a facility-wide list.
    public QueueEntryView getToken(UUID tokenId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        return toView(findToken(tokenId));
    }

    private void validateReason(QueueActionReason reasonCode, String reasonNote) {
        if (reasonCode == null || (reasonCode == QueueActionReason.OTHER && !StringUtils.hasText(reasonNote))) {
            throw new InvalidQueueReasonException();
        }
    }

    // The single write path for queue_token_events — every transition
    // method above calls this rather than constructing QueueTokenEvent
    // directly, same discipline AuditLogService.append() already
    // establishes for the generic audit trail.
    private void recordEvent(UUID tokenId, QueueTokenEventType eventType, TokenStatus fromStatus,
                              TokenStatus toStatus, TokenPriority fromPriority, TokenPriority toPriority,
                              QueueActionReason reasonCode, String reasonNote, UUID performedByUserId,
                              Instant occurredAt) {
        queueTokenEventRepository.save(new QueueTokenEvent(tokenId, eventType, fromStatus, toStatus, fromPriority,
                toPriority, reasonCode, reasonNote, performedByUserId, occurredAt));
    }
}
