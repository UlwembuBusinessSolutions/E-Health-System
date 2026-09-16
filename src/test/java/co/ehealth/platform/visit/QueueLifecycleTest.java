package co.ehealth.platform.visit;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.PatientService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.test.util.ReflectionTestUtils;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class QueueLifecycleTest {
    private final Instant issued = Instant.parse("2026-09-10T08:00:00Z");
    private final Instant now = issued.plusSeconds(600);
    private final UUID clinic = UUID.randomUUID(), actor = UUID.randomUUID(), id = UUID.randomUUID();
    private final QueueTokenRepository repository = mock(QueueTokenRepository.class);
    private final AuditLogService audit = mock(AuditLogService.class);
    private final PermissionService permissions = mock(PermissionService.class);
    private final QueueService service = new QueueService(repository, mock(VisitRepository.class),
            mock(PatientService.class), audit, Clock.fixed(now, ZoneOffset.UTC), permissions);

    @AfterEach void clearClinic() { ClinicContext.clear(); }

    private QueueToken token(TokenStatus status) {
        QueueToken token = new QueueToken(UUID.randomUUID(), clinic, 1, TokenPriority.PRIORITY, false, issued, actor);
        ReflectionTestUtils.setField(token, "id", id);
        ReflectionTestUtils.setField(token, "status", status);
        return token;
    }

    private void select(QueueToken token) {
        ClinicContext.set(clinic);
        when(repository.findByIdAndFacilityId(id, clinic)).thenReturn(Optional.of(token));
    }

    @ParameterizedTest @EnumSource(value = TokenStatus.class, names = {"CALLED", "IN_SERVICE"})
    void completionRecordsTimeAndAudits(TokenStatus status) {
        QueueToken token = token(status);
        select(token);
        service.transition(id, QueueService.TokenAction.COMPLETE, null, actor);
        assertThat(token.getStatus()).isEqualTo(TokenStatus.COMPLETED);
        assertThat(token.getCompletedAt()).isEqualTo(now);
        verify(audit).append(actor, clinic, "QUEUE_TOKEN_COMPLETED", "QueueToken", id.toString(), "{\"status\":\"" + status.name() + "\"}", "{\"status\":\"COMPLETED\"}");
    }

    @ParameterizedTest @EnumSource(CancellationReason.class)
    void cancellationRequiresAndAuditsReason(CancellationReason reason) {
        QueueToken token = token(TokenStatus.CALLED);
        select(token);
        service.transition(id, QueueService.TokenAction.CANCEL, reason, actor);
        assertThat(token.getCancelledAt()).isEqualTo(now);
        assertThat(token.getCancellationReason()).isEqualTo(reason);
        verify(audit).append(actor, clinic, "QUEUE_TOKEN_CANCELLED", "QueueToken", id.toString(), "{\"status\":\"CALLED\"}", "{\"status\":\"CANCELLED\",\"reasonCode\":\"" + reason + "\"}");
    }

    @Test void missingReasonDoesNotWriteOrAudit() {
        QueueToken token = token(TokenStatus.CALLED);
        select(token);
        assertThatThrownBy(() -> service.transition(id, QueueService.TokenAction.CANCEL, null, actor))
                .isInstanceOf(TokenTransitionException.class);
        assertThat(token.getStatus()).isEqualTo(TokenStatus.CALLED);
        verify(repository, never()).saveAndFlush(any());
        verifyNoInteractions(audit);
    }

    @ParameterizedTest @EnumSource(value = TokenStatus.class, names = {"ISSUED", "CALLED", "IN_SERVICE"})
    void resumePreservesOriginalQueueRanking(TokenStatus status) {
        QueueToken token = token(status);
        select(token);
        service.transition(id, QueueService.TokenAction.STOP, null, actor);
        assertThat(token.getStoppedAt()).isEqualTo(now);
        service.transition(id, QueueService.TokenAction.RESUME, null, actor);
        assertThat(token.getStatus()).isEqualTo(TokenStatus.ISSUED);
        assertThat(token.getPriority()).isEqualTo(TokenPriority.PRIORITY);
        assertThat(token.getIssuedAt()).isEqualTo(issued);
        assertThat(token.getCalledAt()).isNull();
        verify(audit).append(actor, clinic, "QUEUE_TOKEN_RESUMED", "QueueToken", id.toString(), "{\"status\":\"STOPPED\"}", "{\"status\":\"ISSUED\"}");
    }

    @ParameterizedTest @EnumSource(TokenStatus.class)
    void stateMachineRejectsEveryInvalidTransition(TokenStatus status) {
        for (QueueService.TokenAction action : QueueService.TokenAction.values()) {
            boolean allowed = switch (action) {
                case START_SERVICE -> status == TokenStatus.CALLED;
                case COMPLETE -> status == TokenStatus.CALLED || status == TokenStatus.IN_SERVICE;
                case STOP -> Set.of(TokenStatus.ISSUED, TokenStatus.CALLED, TokenStatus.IN_SERVICE).contains(status);
                case RESUME -> status == TokenStatus.STOPPED;
                case CANCEL -> status != TokenStatus.COMPLETED && status != TokenStatus.CANCELLED;
            };
            QueueToken token = token(status);
            select(token);
            if (allowed) assertThatCode(() -> service.transition(id, action, CancellationReason.PATIENT_LEFT, actor)).doesNotThrowAnyException();
            else {
                assertThatThrownBy(() -> service.transition(id, action, CancellationReason.PATIENT_LEFT, actor)).isInstanceOf(TokenTransitionException.class);
                assertThat(token.getStatus()).isEqualTo(status);
            }
        }
    }

    @Test void conflictingUpdateDoesNotCreateAnAuditEntry() {
        select(token(TokenStatus.CALLED));
        doThrow(new org.springframework.orm.ObjectOptimisticLockingFailureException(QueueToken.class, id))
                .when(repository).saveAndFlush(any());
        assertThatThrownBy(() -> service.transition(id, QueueService.TokenAction.COMPLETE, null, actor))
                .isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);
        verifyNoInteractions(audit);
    }

    @Test void tokensInAnotherClinicCannotBeChanged() {
        ClinicContext.set(clinic);
        when(repository.findByIdAndFacilityId(id, clinic)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.transition(id, QueueService.TokenAction.STOP, null, actor)).isInstanceOf(TokenTransitionException.class);
        verifyNoInteractions(audit);
    }

    @Test void permissionIsCheckedBeforeTokenLookup() {
        doThrow(new SecurityException()).when(permissions).requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        assertThatThrownBy(() -> service.transition(id, QueueService.TokenAction.STOP, null, actor)).isInstanceOf(SecurityException.class);
        verifyNoInteractions(repository, audit);
    }
}
