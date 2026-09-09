package co.ehealth.platform.core.audit;

// lihle | 2026-09-09 | Added clinic context to audit handling so actions can be traced to the clinic where they occurred.

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    java.util.List<AuditLog> findByClinicContextIdOrderByCreatedAtDesc(UUID clinicContextId);
}
