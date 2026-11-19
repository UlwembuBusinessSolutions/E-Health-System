package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.PatientService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.anyList;

class VisitServiceTest {

    private final VisitRepository visits = mock(VisitRepository.class);
    private final PatientService patients = mock(PatientService.class);
    private final FacilityService facilities = mock(FacilityService.class);
    private final FacilityRepository facilityRepository = mock(FacilityRepository.class);
    private final QueueTokenRepository tokens = mock(QueueTokenRepository.class);
    private final QueueService queue = mock(QueueService.class);
    private final AuditLogService audit = mock(AuditLogService.class);
    private final PermissionService permissions = mock(PermissionService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-03T08:00:00Z"), ZoneOffset.UTC);

    private final VisitService service = new VisitService(visits, patients, facilities, facilityRepository, tokens,
            queue, audit, clock, permissions);

    @Test
    void walkInCreatesQueueVisitWithoutPatientAndIssuesToken() {
        UUID facilityId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        QueueToken token = mock(QueueToken.class);
        when(token.getId()).thenReturn(UUID.randomUUID());
        when(queue.issueAutomaticToken(any(Visit.class), eq(staffId))).thenReturn(token);

        VisitService.VisitWithToken result = service.createWalkInVisit(facilityId, staffId);

        assertNull(result.visit().getPatientId());
        assertEquals(facilityId, result.visit().getFacilityId());
        assertEquals(VisitType.NEW, result.visit().getVisitType());
        assertEquals(ServiceStream.GENERAL, result.visit().getServiceStream());
        assertEquals(clock.instant(), result.visit().getVisitDateTime());
        assertThrows(UnregisteredWalkInVisitException.class, result.visit()::requirePatientId);
        assertEquals(token, result.token());
        verify(facilities).get(facilityId);
        verify(patients, never()).get(any());
        verify(queue).issueAutomaticToken(any(Visit.class), eq(staffId));
        verify(audit).append(staffId, facilityId, "WALK_IN_QUEUE_TOKEN_ISSUED", "QueueToken",
                token.getId().toString(), null, null);
    }

    @Test
    void registeredVisitIsRejectedWhenPatientAlreadyHasAnUnfinishedQueueVisit() {
        UUID patientId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        doThrow(new IncompleteVisitQueueException()).when(queue).requireNoIncompleteQueueVisit(patientId);
        VisitService.CreateVisitCommand command = new VisitService.CreateVisitCommand(
                patientId, facilityId, VisitType.FOLLOW_UP, ServiceStream.GENERAL);

        assertThrows(IncompleteVisitQueueException.class, () -> service.createVisit(command, staffId));

        verify(patients).getForUpdate(patientId);
        verify(visits, never()).save(any(Visit.class));
        verify(queue, never()).issueAutomaticToken(any(Visit.class), eq(staffId));
    }

    @Test
    void activeQueueVisitReturnsTheMostRecentVisitWithAnActiveToken() {
        UUID patientId = UUID.randomUUID();
        Visit recent = visit(patientId, clock.instant());
        Visit earlier = visit(patientId, clock.instant().minusSeconds(60));
        QueueToken recentToken = token(recent, TokenStatus.CALLED);
        QueueToken earlierToken = token(earlier, TokenStatus.ISSUED);
        when(visits.findByPatientIdOrderByVisitDateTimeDesc(patientId)).thenReturn(List.of(recent, earlier));
        when(tokens.findByVisitIdIn(anyList())).thenReturn(List.of(recentToken, earlierToken));

        assertEquals(Optional.of(recent), service.getActiveQueueVisit(patientId));
    }

    @Test
    void completedAndCancelledTokensDoNotResolveAsAnActiveQueueVisit() {
        UUID patientId = UUID.randomUUID();
        Visit visit = visit(patientId, clock.instant());
        when(visits.findByPatientIdOrderByVisitDateTimeDesc(patientId)).thenReturn(List.of(visit));
        QueueToken completed = token(visit, TokenStatus.COMPLETED);
        QueueToken cancelled = token(visit, TokenStatus.CANCELLED);
        when(tokens.findByVisitIdIn(anyList())).thenReturn(List.of(completed, cancelled));

        assertTrue(service.getActiveQueueVisit(patientId).isEmpty());
    }

    private Visit visit(UUID patientId, Instant visitDateTime) {
        Visit visit = new Visit(patientId, UUID.randomUUID(), VisitType.NEW, ServiceStream.CHRONIC_CARE,
                visitDateTime, UUID.randomUUID());
        ReflectionTestUtils.setField(visit, "id", UUID.randomUUID());
        return visit;
    }

    private QueueToken token(Visit visit, TokenStatus status) {
        QueueToken token = mock(QueueToken.class);
        when(token.getVisitId()).thenReturn(visit.getId());
        when(token.getStatus()).thenReturn(status);
        return token;
    }
}
