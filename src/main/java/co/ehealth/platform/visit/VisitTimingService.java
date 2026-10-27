package co.ehealth.platform.visit;

import co.ehealth.platform.consultation.Consultation;
import co.ehealth.platform.consultation.ConsultationRepository;
import co.ehealth.platform.consultation.ConsultationStatus;
import co.ehealth.platform.triage.TriageAssessmentRepository;
import co.ehealth.platform.triage.TriageAssessmentStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Adapts Emilio's stage timeline to durable events already saved by this app.
 * No browser-session counters or duplicate tracking rows; historical visits work too. */
@Service
@Transactional(readOnly = true)
public class VisitTimingService {
    private final VisitRepository visits;
    private final ConsultationRepository consultations;
    private final QueueTokenRepository tokens;
    private final TriageAssessmentRepository triage;
    private final Clock clock;

    public VisitTimingService(VisitRepository visits, ConsultationRepository consultations,
                              QueueTokenRepository tokens, TriageAssessmentRepository triage, Clock clock) {
        this.visits = visits;
        this.consultations = consultations;
        this.tokens = tokens;
        this.triage = triage;
        this.clock = clock;
    }

    public Snapshot get(UUID visitId) {
        Visit visit = visits.findById(visitId).orElseThrow(VisitNotFoundException::new);
        return forPatient(visit.getPatientId()).stream().filter(s -> s.visitId().equals(visitId))
                .findFirst().orElseThrow(VisitNotFoundException::new);
    }

    public List<Snapshot> forPatient(UUID patientId) {
        List<Visit> all = visits.findByPatientIdOrderByVisitDateTimeDesc(patientId);
        if (all.isEmpty()) return List.of();
        Map<UUID, Visit> byId = all.stream().collect(Collectors.toMap(Visit::getId, Function.identity()));
        Map<UUID, UUID> roots = new HashMap<>();
        for (Visit visit : all) {
            Visit root = visit;
            Set<UUID> seen = new HashSet<>();
            while (root.getTransferredFromVisitId() != null && seen.add(root.getId())
                    && byId.containsKey(root.getTransferredFromVisitId())) {
                root = byId.get(root.getTransferredFromVisitId());
            }
            roots.put(visit.getId(), root.getId());
        }
        List<UUID> ids = all.stream().map(Visit::getId).toList();
        Map<UUID, List<Consultation>> consultByVisit = consultations.findByVisitIdIn(ids).stream()
                .filter(c -> c.getStatus() != ConsultationStatus.ENTERED_IN_ERROR)
                .collect(Collectors.groupingBy(Consultation::getVisitId));
        Map<UUID, List<QueueToken>> tokensByVisit = tokens.findByVisitIdIn(ids).stream()
                .collect(Collectors.groupingBy(QueueToken::getVisitId));
        var assessments = triage.findByVisitIdInOrderByObservedAtDesc(ids);
        Set<UUID> transferredOut = all.stream().map(Visit::getTransferredFromVisitId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Instant now = clock.instant();
        Map<UUID, Snapshot> journeys = new HashMap<>();
        for (UUID rootId : new HashSet<>(roots.values())) {
            Instant started = byId.get(rootId).getVisitDateTime();
            Set<UUID> journeyIds = roots.entrySet().stream().filter(e -> e.getValue().equals(rootId))
                    .map(Map.Entry::getKey).collect(Collectors.toSet());
            List<Consultation> journeyConsults = journeyIds.stream()
                    .flatMap(id -> consultByVisit.getOrDefault(id, List.of()).stream()).toList();
            Instant consultationStarted = earliest(journeyConsults.stream().map(Consultation::getCreatedAt).toList());
            Instant signed = earliest(journeyConsults.stream().map(Consultation::getSignedAt).toList());
            Instant firstVitals = earliest(assessments.stream()
                    .filter(a -> journeyIds.contains(a.getVisitId()) && a.getStatus() != TriageAssessmentStatus.ENTERED_IN_ERROR)
                    .map(a -> a.getObservedAt()).toList());
            List<End> ends = new ArrayList<>();
            if (signed != null) ends.add(new End(signed, "CONSULTATION_FINISHED"));
            for (UUID id : journeyIds) {
                for (QueueToken token : tokensByVisit.getOrDefault(id, List.of())) {
                    if (token.getCompletedAt() != null) ends.add(new End(token.getCompletedAt(), "VISIT_COMPLETED"));
                    // A transfer cancels the source token but continues the same journey.
                    if (token.getCancelledAt() != null && !transferredOut.contains(id))
                        ends.add(new End(token.getCancelledAt(), "VISIT_CANCELLED"));
                }
            }
            End end = ends.stream().min(Comparator.comparing(End::at)).orElse(null);
            Instant finished = end == null ? null : end.at();
            Instant until = finished == null ? now : finished;
            Instant beforeConsultationEnd = consultationStarted == null || consultationStarted.isAfter(until) ? until : consultationStarted;
            Long consultationSeconds = consultationStarted == null || consultationStarted.isAfter(until) ? null : seconds(consultationStarted, until);
            journeys.put(rootId, new Snapshot(rootId, rootId, started, firstVitals, consultationStarted, signed,
                    finished, end == null ? null : end.reason(), seconds(started, until),
                    seconds(started, beforeConsultationEnd), consultationSeconds, finished == null, now));
        }
        return all.stream().map(v -> journeys.get(roots.get(v.getId())).forVisit(v.getId())).toList();
    }

    private static Instant earliest(List<Instant> values) {
        return values.stream().filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
    }
    private static long seconds(Instant start, Instant end) {
        return Math.max(0, Duration.between(start, end).getSeconds());
    }
    private record End(Instant at, String reason) {}
    public record Snapshot(UUID visitId, UUID journeyVisitId, Instant startedAt, Instant firstVitalsAt,
                           Instant consultationStartedAt, Instant consultationCompletedAt, Instant finishedAt,
                           String completionReason, long elapsedSeconds, long beforeConsultationSeconds,
                           Long consultationSeconds, boolean active, Instant asOf) {
        Snapshot forVisit(UUID id) {
            return new Snapshot(id, journeyVisitId, startedAt, firstVitalsAt, consultationStartedAt,
                    consultationCompletedAt, finishedAt, completionReason, elapsedSeconds,
                    beforeConsultationSeconds, consultationSeconds, active, asOf);
        }
    }
}
