package co.ehealth.platform.visit;

import co.ehealth.platform.consultation.*;
import co.ehealth.platform.triage.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.anyList;

class VisitTimingServiceTest {
    private final VisitRepository visits = mock(VisitRepository.class);
    private final ConsultationRepository consultations = mock(ConsultationRepository.class);
    private final QueueTokenRepository tokens = mock(QueueTokenRepository.class);
    private final TriageAssessmentRepository triage = mock(TriageAssessmentRepository.class);
    private final UUID patient = UUID.randomUUID();
    private final Instant start = Instant.parse("2026-10-20T08:00:00Z");
    private final VisitTimingService service = new VisitTimingService(visits, consultations, tokens, triage,
            Clock.fixed(start.plusSeconds(3600), ZoneOffset.UTC));

    private Visit visit(Instant at, UUID parent) {
        Visit v = mock(Visit.class);
        doReturn(UUID.randomUUID()).when(v).getId();
        doReturn(patient).when(v).getPatientId();
        doReturn(at).when(v).getVisitDateTime();
        doReturn(parent).when(v).getTransferredFromVisitId();
        return v;
    }
    private void given(Visit... rows) {
        doReturn(List.of(rows)).when(visits).findByPatientIdOrderByVisitDateTimeDesc(patient);
        doReturn(List.of()).when(consultations).findByVisitIdIn(anyList());
        doReturn(List.of()).when(tokens).findByVisitIdIn(anyList());
        doReturn(List.of()).when(triage).findByVisitIdInOrderByObservedAtDesc(anyList());
    }
    private Consultation consultation(Visit v, Instant signed, ConsultationStatus status) {
        Consultation c = mock(Consultation.class);
        doReturn(v.getId()).when(c).getVisitId();
        doReturn(start.plusSeconds(600)).when(c).getCreatedAt();
        doReturn(signed).when(c).getSignedAt();
        doReturn(status).when(c).getStatus();
        return c;
    }
    @Test void activeVisitCountsFromPersistedStartIncludingTimeAwayFromBrowser() {
        Visit v = visit(start, null); given(v);
        var result = service.forPatient(patient).getFirst();
        assertTrue(result.active()); assertEquals(3600, result.elapsedSeconds());
        assertEquals(3600, result.beforeConsultationSeconds()); assertNull(result.finishedAt());
        assertEquals(result, service.forPatient(patient).getFirst());
    }
    @Test void consultationOnlyJourneyFinishesWithoutPharmacy() {
        Visit v = visit(start, null); given(v);
        doReturn(List.of(consultation(v, start.plusSeconds(1800), ConsultationStatus.SIGNED))).when(consultations).findByVisitIdIn(anyList());
        var r = service.forPatient(patient).getFirst();
        assertFalse(r.active()); assertEquals(1800, r.elapsedSeconds());
        assertEquals("CONSULTATION_FINISHED", r.completionReason());
        assertEquals(600, r.beforeConsultationSeconds()); assertEquals(1200L, r.consultationSeconds());
    }
    @Test void queueCompletionStopsEarlierThanConsultationSigning() {
        Visit v = visit(start, null); given(v);
        QueueToken q = mock(QueueToken.class); doReturn(v.getId()).when(q).getVisitId();
        doReturn(start.plusSeconds(900)).when(q).getCompletedAt();
        doReturn(List.of(q)).when(tokens).findByVisitIdIn(anyList());
        doReturn(List.of(consultation(v, start.plusSeconds(1800), ConsultationStatus.SIGNED))).when(consultations).findByVisitIdIn(anyList());
        var r = service.forPatient(patient).getFirst();
        assertEquals(900, r.elapsedSeconds()); assertEquals("VISIT_COMPLETED", r.completionReason());
        assertEquals(300L, r.consultationSeconds());
    }
    @Test void cancelledVisitStopsTheTimer() {
        Visit v = visit(start, null); given(v);
        QueueToken q = mock(QueueToken.class); doReturn(v.getId()).when(q).getVisitId();
        doReturn(start.plusSeconds(300)).when(q).getCancelledAt();
        doReturn(List.of(q)).when(tokens).findByVisitIdIn(anyList());
        var r = service.forPatient(patient).getFirst();
        assertFalse(r.active()); assertEquals(300, r.elapsedSeconds()); assertEquals("VISIT_CANCELLED", r.completionReason());
    }
    @Test void transferCancellationContinuesOriginalJourneyUntilDestinationConsultationEnds() {
        Visit source = visit(start, null); Visit destination = visit(start.plusSeconds(900), source.getId());
        given(destination, source);
        QueueToken q = mock(QueueToken.class); doReturn(source.getId()).when(q).getVisitId();
        doReturn(start.plusSeconds(900)).when(q).getCancelledAt();
        doReturn(List.of(q)).when(tokens).findByVisitIdIn(anyList());
        assertTrue(service.forPatient(patient).getFirst().active());
        doReturn(List.of(consultation(destination, start.plusSeconds(2400), ConsultationStatus.SIGNED))).when(consultations).findByVisitIdIn(anyList());
        var results = service.forPatient(patient);
        assertEquals(2, results.size());
        for (var r : results) { assertEquals(source.getId(), r.journeyVisitId()); assertEquals(2400, r.elapsedSeconds()); assertFalse(r.active()); }
    }
    @Test void invalidatedConsultationDoesNotStopTimingButSupersededSignatureRetainsOriginalEnd() {
        Visit v = visit(start, null); given(v);
        doReturn(List.of(consultation(v, start.plusSeconds(300), ConsultationStatus.ENTERED_IN_ERROR))).when(consultations).findByVisitIdIn(anyList());
        assertTrue(service.forPatient(patient).getFirst().active());
        doReturn(List.of(consultation(v, start.plusSeconds(1800), ConsultationStatus.SUPERSEDED), consultation(v, start.plusSeconds(2200), ConsultationStatus.SIGNED))).when(consultations).findByVisitIdIn(anyList());
        assertEquals(1800, service.forPatient(patient).getFirst().elapsedSeconds());
    }
    @Test void negativeClockSkewDoesNotProduceNegativeDuration() {
        Visit v = visit(start.plusSeconds(7200), null); given(v);
        assertEquals(0, service.forPatient(patient).getFirst().elapsedSeconds());
    }
    @Test void emptyHistoryDoesNotQueryOtherPatients() {
        doReturn(List.of()).when(visits).findByPatientIdOrderByVisitDateTimeDesc(patient);
        assertTrue(service.forPatient(patient).isEmpty());
        verifyNoInteractions(consultations, tokens, triage);
    }
}
