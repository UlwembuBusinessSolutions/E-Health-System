package co.ehealth.platform.platform;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// AUDT-US-005's platform-side counterpart — every platform-operator action
// (org lifecycle, module toggles, operator management), filterable by
// action/organization/date range. Read-only by construction: this service
// has no write methods and never will — recordPlatformAudit() in
// OrganizationProvisioningService and PlatformOperatorService are the only
// two write paths, matching AUDT-US-004's append-only intent even though
// nothing here enforces it at the database-grant level yet.
@Service
public class PlatformAuditService {

    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final PlatformOperatorRepository platformOperatorRepository;
    private final OrganizationRepository organizationRepository;

    public PlatformAuditService(PlatformAuditLogRepository platformAuditLogRepository,
                                 PlatformOperatorRepository platformOperatorRepository,
                                 OrganizationRepository organizationRepository) {
        this.platformAuditLogRepository = platformAuditLogRepository;
        this.platformOperatorRepository = platformOperatorRepository;
        this.organizationRepository = organizationRepository;
    }

    public List<PlatformAuditEntryView> list(String action, UUID organizationId, Instant from, Instant to) {
        Specification<PlatformAuditLog> spec = Specification.where(null);
        if (action != null && !action.isBlank()) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("action"), action));
        }
        if (organizationId != null) {
            spec = spec.and((root, cq, cb) -> cb.equal(root.get("organizationId"), organizationId));
        }
        if (from != null) {
            spec = spec.and((root, cq, cb) -> cb.greaterThanOrEqualTo(root.get("createdAt"), from));
        }
        if (to != null) {
            spec = spec.and((root, cq, cb) -> cb.lessThanOrEqualTo(root.get("createdAt"), to));
        }

        List<PlatformAuditLog> rows =
                platformAuditLogRepository.findAll(spec, Sort.by(Sort.Direction.DESC, "createdAt"));

        // Two bulk lookups rather than one query per row — every audit
        // screen this feeds shows potentially dozens of rows at once, and
        // operator/org identities repeat heavily (the same handful of
        // operators and orgs account for most activity).
        Set<UUID> operatorIds = rows.stream().map(PlatformAuditLog::getPlatformOperatorId).collect(Collectors.toSet());
        Map<UUID, PlatformOperator> operatorsById = platformOperatorRepository.findAllById(operatorIds).stream()
                .collect(Collectors.toMap(PlatformOperator::getId, o -> o));

        Set<UUID> organizationIds = rows.stream().map(PlatformAuditLog::getOrganizationId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, Organization> organizationsById = organizationRepository.findAllById(organizationIds).stream()
                .collect(Collectors.toMap(Organization::getId, o -> o));

        return rows.stream().map(row -> {
            PlatformOperator operator = operatorsById.get(row.getPlatformOperatorId());
            Organization organization = row.getOrganizationId() != null
                    ? organizationsById.get(row.getOrganizationId()) : null;
            return new PlatformAuditEntryView(
                    row.getId(),
                    row.getAction(),
                    row.getDetail(),
                    row.getCreatedAt(),
                    operator != null ? operator.getFirstName() + " " + operator.getLastName() : "Unknown operator",
                    operator != null ? operator.getEmail() : null,
                    row.getOrganizationId(),
                    organization != null ? organization.getDisplayName() : null,
                    row.getIpAddress(),
                    row.getDeviceSignature());
        }).toList();
    }

    public record PlatformAuditEntryView(
            UUID id, String action, String detail, Instant createdAt,
            String operatorName, String operatorEmail, UUID organizationId, String organizationName,
            String ipAddress, String deviceSignature) {
    }
}
