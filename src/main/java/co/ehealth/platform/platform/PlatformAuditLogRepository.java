package co.ehealth.platform.platform;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

// JpaSpecificationExecutor — PlatformAuditService.list()'s filters (action,
// organization, date range) are each optional and independently combinable,
// same reasoning as OrganizationRepository's own why-note on
// listOrganizations().
public interface PlatformAuditLogRepository extends JpaRepository<PlatformAuditLog, UUID>,
        JpaSpecificationExecutor<PlatformAuditLog> {

    // PlatformOperatorService.delete()'s pre-check — platform_audit_log has
    // no ON DELETE CASCADE back to platform_operators (V2__platform_operators.sql),
    // so deleting an operator with any history here fails at the database
    // with an opaque foreign-key error. Checking first means the rejection
    // can carry a message that actually explains why, instead of the
    // generic 409 DataIntegrityViolationException produces.
    boolean existsByPlatformOperatorId(UUID platformOperatorId);
}
