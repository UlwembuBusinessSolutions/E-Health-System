// package co.ehealth.platform.core.audit;

// import org.springframework.data.jpa.repository.JpaRepository;

// import java.util.UUID;

// public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
// }

package co.ehealth.platform.core.audit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.UUID;

public interface AuditLogRepository extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {
}