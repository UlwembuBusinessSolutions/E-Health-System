package co.ehealth.platform.core.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

// JpaSpecificationExecutor backs AuditLogService's date-range filtering —
// same reasoning as PlatformAuditLogRepository's own why-note: a
// Specification composes the "only if the caller actually filtered by
// this" branches list()/listAllForExport() need without a matrix of
// findByCreatedAtBetween-style derived query methods.
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {
}
