package co.ehealth.platform.core.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    java.util.List<AuditLog> findByClinicContextIdOrderByCreatedAtDesc(UUID clinicContextId);
}
