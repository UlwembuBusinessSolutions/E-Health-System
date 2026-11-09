package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.PatientService;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class QueueServiceTest {
    private final QueueTokenRepository tokens = mock(QueueTokenRepository.class);
    private final QueueTokenEventRepository events = mock(QueueTokenEventRepository.class);
    private final VisitRepository visits = mock(VisitRepository.class);
    private final PatientService patients = mock(PatientService.class);
    private final AuditLogService audit = mock(AuditLogService.class);
    private final PermissionService permissions = mock(PermissionService.class);
    private final FacilityRepository facilities = mock(FacilityRepository.class);
    private final QueueService service = new QueueService(tokens, events, visits, patients, audit,
            Clock.fixed(Instant.parse("2026-11-03T08:00:00Z"), ZoneOffset.UTC), permissions, facilities);

    @Test
    void linksAnExistingUnregisteredWalkInVisit() {
        UUID tokenId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID patientId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        QueueToken token = mock(QueueToken.class);
        when(token.getId()).thenReturn(tokenId);
        when(token.getFacilityId()).thenReturn(facilityId);
        Visit visit = new Visit(null, facilityId, VisitType.NEW, ServiceStream.GENERAL,
                Instant.parse("2026-11-03T08:00:00Z"), null);
        when(tokens.findById(tokenId)).thenReturn(Optional.of(token));
        when(token.getVisitId()).thenReturn(visitId);
        when(visits.findByIdForUpdate(visitId)).thenReturn(Optional.of(visit));

        service.linkWalkInTokenToPatient(tokenId, patientId, staffId);
        assertEquals(patientId, visit.getPatientId());
        verify(visits).findByIdForUpdate(visitId);
        verify(audit).append(staffId, facilityId, "WALK_IN_TOKEN_LINKED_TO_PATIENT",
                "QueueToken", tokenId.toString(), null, null);
    }

    @Test
    void linkingTheSamePatientIsIdempotentAndAnotherPatientIsRejected() {
        UUID tokenId = UUID.randomUUID();
        UUID visitId = UUID.randomUUID();
        UUID staffId = UUID.randomUUID();
        UUID existingPatientId = UUID.randomUUID();
        QueueToken token = mock(QueueToken.class);
        Visit visit = new Visit(existingPatientId, UUID.randomUUID(), VisitType.NEW, ServiceStream.GENERAL,
                Instant.parse("2026-11-03T08:00:00Z"), null);
        when(tokens.findById(tokenId)).thenReturn(Optional.of(token));
        when(token.getVisitId()).thenReturn(visitId);
        when(visits.findByIdForUpdate(visitId)).thenReturn(Optional.of(visit));

        service.linkWalkInTokenToPatient(tokenId, existingPatientId, staffId);
        assertThrows(QueueTokenAlreadyLinkedException.class,
                () -> service.linkWalkInTokenToPatient(tokenId, UUID.randomUUID(), staffId));
        assertEquals(existingPatientId, visit.getPatientId());

        UUID missingTokenId = UUID.randomUUID();
        when(tokens.findById(missingTokenId)).thenReturn(Optional.empty());
        assertThrows(QueueTokenNotFoundException.class,
                () -> service.linkWalkInTokenToPatient(missingTokenId, UUID.randomUUID(), staffId));
    }
}
