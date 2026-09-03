package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.PatientNotFoundException;
import co.ehealth.platform.patient.PatientService;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QueueTokenStoryTest {

    private static final UUID PATIENT_ID = UUID.fromString("8e9da3d4-3ee3-420a-a4df-5ed0e4cc7f4f");
    private static final UUID FACILITY_ID = UUID.fromString("62a2f7b2-069e-4ba2-bf1a-81c8d5791199");
    private static final UUID STAFF_ID = UUID.fromString("56dd6bf3-ed47-4246-a98f-89d9be89d6b7");
    private static final UUID VISIT_ID = UUID.fromString("075dc3f7-afc0-4769-b8a4-ab817e9fa8f1");

    @Test
    void creatingVisitAutomaticallyIssuesNormalQueueToken() {
        VisitRepository visits = mock(VisitRepository.class);
        PatientService patients = mock(PatientService.class);
        FacilityService facilities = mock(FacilityService.class);
        QueueService queue = mock(QueueService.class);
        AuditLogService audit = mock(AuditLogService.class);
        when(visits.save(any(Visit.class))).thenAnswer(invocation -> {
            Visit visit = invocation.getArgument(0);
            ReflectionTestUtils.setField(visit, "id", VISIT_ID);
            return visit;
        });
        when(queue.issueAutomaticToken(any(Visit.class), eq(STAFF_ID))).thenAnswer(invocation -> {
            Visit visit = invocation.getArgument(0);
            return token(visit.getId(), FACILITY_ID, 1, Instant.parse("2026-08-25T08:00:00Z"));
        });

        VisitService service = new VisitService(visits, patients, facilities, queue, audit,
                Clock.fixed(Instant.parse("2026-08-25T08:00:00Z"), ZoneOffset.UTC), mock(PermissionService.class));
        VisitService.VisitWithToken result = service.createVisit(new VisitService.CreateVisitCommand(PATIENT_ID,
                FACILITY_ID, VisitType.NEW, ServiceStream.GENERAL), STAFF_ID);

        assertThat(result.token().getTokenNumber()).isEqualTo(1);
        assertThat(result.token().getPriority()).isEqualTo(TokenPriority.NORMAL);
        assertThat(result.token().isManual()).isFalse();
        verify(patients).get(PATIENT_ID);
        verify(facilities).get(FACILITY_ID);
        verify(queue).issueAutomaticToken(any(Visit.class), eq(STAFF_ID));
        verify(audit).append(eq(STAFF_ID), eq(FACILITY_ID), eq("VISIT_CREATED"), eq("Visit"),
                eq(VISIT_ID.toString()), eq(null), eq(null));
    }

    @Test
    void unknownPatientBlocksVisitAndTokenCreationBeforeAnyWrite() {
        VisitRepository visits = mock(VisitRepository.class);
        PatientService patients = mock(PatientService.class);
        doThrow(new PatientNotFoundException()).when(patients).get(PATIENT_ID);
        QueueService queue = mock(QueueService.class);
        VisitService service = new VisitService(visits, patients, mock(FacilityService.class), queue,
                mock(AuditLogService.class), Clock.systemUTC(), mock(PermissionService.class));

        assertThatThrownBy(() -> service.createVisit(new VisitService.CreateVisitCommand(PATIENT_ID, FACILITY_ID,
                VisitType.NEW, ServiceStream.GENERAL), STAFF_ID)).isInstanceOf(PatientNotFoundException.class);

        verify(visits, never()).save(any());
        verify(queue, never()).issueAutomaticToken(any(), any());
    }

    @Test
    void dailyFacilityNumberingResetsWithoutScheduledState() {
        QueueTokenRepository tokens = mock(QueueTokenRepository.class);
        when(tokens.countByFacilityIdAndIssuedAtBetween(eq(FACILITY_ID), any(), any())).thenReturn(3L, 0L);
        when(tokens.save(any(QueueToken.class))).thenAnswer(invocation -> {
            QueueToken token = invocation.getArgument(0);
            ReflectionTestUtils.setField(token, "id", UUID.randomUUID());
            return token;
        });
        AuditLogService audit = mock(AuditLogService.class);

        QueueToken first = queueService(tokens, audit, Instant.parse("2026-08-25T23:59:59Z"))
                .issueAutomaticToken(visit(PATIENT_ID, FACILITY_ID), STAFF_ID);
        QueueToken nextDay = queueService(tokens, audit, Instant.parse("2026-08-26T00:00:00Z"))
                .issueAutomaticToken(visit(PATIENT_ID, FACILITY_ID), STAFF_ID);

        assertThat(first.getTokenNumber()).isEqualTo(4);
        assertThat(nextDay.getTokenNumber()).isEqualTo(1);
        assertThat(nextDay.getIssuedAt()).isEqualTo(Instant.parse("2026-08-26T00:00:00Z"));
    }

    private QueueService queueService(QueueTokenRepository tokens, AuditLogService audit, Instant now) {
        return new QueueService(tokens, mock(VisitRepository.class), mock(PatientService.class), audit,
                Clock.fixed(now, ZoneOffset.UTC), mock(PermissionService.class));
    }

    private Visit visit(UUID patientId, UUID facilityId) {
        Visit visit = new Visit(patientId, facilityId, VisitType.NEW, ServiceStream.GENERAL,
                Instant.parse("2026-08-25T08:00:00Z"), STAFF_ID);
        ReflectionTestUtils.setField(visit, "id", UUID.randomUUID());
        return visit;
    }

    private QueueToken token(UUID visitId, UUID facilityId, int number, Instant issuedAt) {
        QueueToken token = new QueueToken(visitId, facilityId, number, TokenPriority.NORMAL, false, issuedAt, STAFF_ID);
        ReflectionTestUtils.setField(token, "id", UUID.randomUUID());
        return token;
    }
}
