// package co.ehealth.platform.core.audit;

// import co.ehealth.platform.core.common.RequestMetadata;
// import co.ehealth.platform.core.tenant.ModuleCode;
// import org.springframework.data.domain.Sort;
// import org.springframework.data.jpa.domain.Specification;
// import org.springframework.stereotype.Service;

// import java.time.Clock;
// import java.time.Instant;
// import java.util.List;
// import java.util.Map;
// import java.util.Set;
// import java.util.UUID;

// @Service
// public class AuditLogService {

//     private final AuditLogRepository auditLogRepository;
//     private final Clock clock;

//     public AuditLogService(AuditLogRepository auditLogRepository, Clock clock) {
//         this.auditLogRepository = auditLogRepository;
//         this.clock = clock;
//     }

//     public List<AuditLog> listAll() {
//         return auditLogRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
//     }

//     public void append(UUID userId, UUID facilityId, String action, String entityType, String entityId,
//             String beforeValue, String afterValue) {
//         auditLogRepository.save(new AuditLog(userId, facilityId, action, entityType, entityId,
//                 beforeValue, afterValue, RequestMetadata.currentIpAddress(), RequestMetadata.currentUserAgent(),
//                 clock.instant()));
//     }

//     public List<AuditLog> search(AuditLogSearchCriteria criteria) {
//         Specification<AuditLog> spec = Specification.where(null);

//         if (criteria.from() != null) {
//             spec = spec.and((root, cq, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), criteria.from()));
//         }
//         if (criteria.to() != null) {
//             spec = spec.and((root, cq, cb) -> cb.lessThan(root.get("createdAt"), criteria.to()));
//         }
//         if (criteria.userId() != null) {
//             spec = spec.and((root, cq, cb) -> cb.equal(root.get("userId"), criteria.userId()));
//         }
//         if (criteria.action() != null && !criteria.action().isBlank()) {
//             spec = spec.and((root, cq, cb) -> cb.equal(root.get("action"), criteria.action()));
//         }
//         if (criteria.entityId() != null && !criteria.entityId().isBlank()) {
//             spec = spec.and((root, cq, cb) -> cb.equal(root.get("entityId"), criteria.entityId()));
//         }
//         if (criteria.module() != null) {
//             Set<String> entityTypes = MODULE_ENTITY_TYPES.getOrDefault(criteria.module(), Set.of());
//             spec = spec.and((root, cq, cb) -> root.get("entityType").in(entityTypes));
//         }

//         return auditLogRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));
//     }

//     private static final Map<ModuleCode, Set<String>> MODULE_ENTITY_TYPES = Map.of(
//             ModuleCode.IAM, Set.of("User", "UserComplianceDetails"),
//             ModuleCode.PREG, Set.of("Patient"),
//             ModuleCode.RECQ, Set.of("Visit", "QueueToken"),
//             ModuleCode.PHRM, Set.of("Prescription"),
//             ModuleCode.SADM, Set.of("Organization"));

//     public record AuditLogSearchCriteria(
//             Instant from, Instant to, UUID userId, String action, ModuleCode module, String entityId) {
//     }
// }

package co.ehealth.platform.core.audit;

import co.ehealth.platform.core.common.RequestMetadata;
import co.ehealth.platform.core.security.PlatformOperatorPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final Clock clock;

    public AuditLogService(AuditLogRepository auditLogRepository, Clock clock) {
        this.auditLogRepository = auditLogRepository;
        this.clock = clock;
    }

    public List<AuditLog> listAll() {
        return auditLogRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    public void append(UUID userId, UUID facilityId, String action, String entityType, String entityId,
            String beforeValue, String afterValue) {
        auditLogRepository.save(new AuditLog(userId, facilityId, action, entityType, entityId,
                beforeValue, afterValue, RequestMetadata.currentIpAddress(), RequestMetadata.currentUserAgent(),
                isPrivilegedActor(), clock.instant()));
    }

    private boolean isPrivilegedActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof PlatformOperatorPrincipal;
    }

    public List<AuditLog> search(AuditLogSearchCriteria criteria) {
        Specification<AuditLog> spec = Specification.where(null);

        if (criteria.from() != null) {
            spec = spec.and((root, cq, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), criteria.from()));
        }
        if (criteria.to() != null) {
            spec = spec.and((root, cq, cb) -> cb.lessThan(root.get("createdAt"), criteria.to()));
        }
        if (criteria.userId() != null) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("userId"), criteria.userId()));
        }
        if (criteria.action() != null && !criteria.action().isBlank()) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("action"), criteria.action()));
        }
        if (criteria.entityId() != null && !criteria.entityId().isBlank()) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("entityId"), criteria.entityId()));
        }
        if (criteria.module() != null) {
            Set<String> entityTypes = MODULE_ENTITY_TYPES.getOrDefault(criteria.module(), Set.of());
            spec = spec.and((root, cq, cb) -> root.get("entityType").in(entityTypes));
        }
        if (criteria.privileged() != null) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("privileged"), criteria.privileged()));
        }

        return auditLogRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    private static final Map<ModuleCode, Set<String>> MODULE_ENTITY_TYPES = Map.of(
            ModuleCode.IAM, Set.of("User", "UserComplianceDetails"),
            ModuleCode.PREG, Set.of("Patient"),
            ModuleCode.RECQ, Set.of("Visit", "QueueToken"),
            ModuleCode.PHRM, Set.of("Prescription"),
            ModuleCode.SADM, Set.of("Organization"));

    public record AuditLogSearchCriteria(
            Instant from, Instant to, UUID userId, String action, ModuleCode module, String entityId,
            Boolean privileged) {
    }
}