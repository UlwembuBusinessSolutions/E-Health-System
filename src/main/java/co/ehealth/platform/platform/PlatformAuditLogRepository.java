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
}
