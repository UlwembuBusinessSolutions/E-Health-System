package co.ehealth.platform.platform;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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

    public static final int DEFAULT_PAGE_SIZE = 50;
    public static final int MAX_PAGE_SIZE = 100;

    // CSV export bypasses normal paging on purpose — the whole point is the
    // full filtered result, not one page of it (a naive "export the current
    // page" would silently under-report). Still bounded: an unqualified
    // "export everything" against a genuinely large trail belongs on a
    // background job, not a synchronous request — this cap is where that
    // line is drawn for now, high enough that no realistic filtered export
    // hits it today.
    public static final int EXPORT_MAX_ROWS = 10_000;

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

    public PagedResult list(String action, UUID organizationId, Instant from, Instant to, int page, int size) {
        Specification<PlatformAuditLog> spec = buildSpec(action, organizationId, from, to);
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        var resultPage = platformAuditLogRepository.findAll(spec, pageable);
        List<PlatformAuditEntryView> items = enrich(resultPage.getContent());
        return new PagedResult(items, page, boundedSize, resultPage.getTotalElements(), resultPage.hasNext());
    }

    // The CSV export's read half — every row matching the caller's own
    // filters, not just whichever page they last had open.
    public List<PlatformAuditEntryView> listAllForExport(String action, UUID organizationId, Instant from,
                                                           Instant to) {
        Specification<PlatformAuditLog> spec = buildSpec(action, organizationId, from, to);
        Pageable pageable = PageRequest.of(0, EXPORT_MAX_ROWS, Sort.by(Sort.Direction.DESC, "createdAt"));
        return enrich(platformAuditLogRepository.findAll(spec, pageable).getContent());
    }

    private Specification<PlatformAuditLog> buildSpec(String action, UUID organizationId, Instant from, Instant to) {
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
            // Exclusive: `to` is already the START of the day AFTER the
            // requested end date (PlatformAuditController computes
            // to.plusDays(1) at UTC midnight) — <= here would additionally
            // include anything stamped exactly at that following midnight,
            // one instant past the requested range.
            spec = spec.and((root, cq, cb) -> cb.lessThan(root.get("createdAt"), to));
        }
        return spec;
    }

    private List<PlatformAuditEntryView> enrich(List<PlatformAuditLog> rows) {
        // Two bulk lookups rather than one query per row — every audit
        // screen this feeds shows potentially dozens (or, for an export,
        // thousands) of rows at once, and operator/org identities repeat
        // heavily (the same handful of operators and orgs account for most
        // activity).
        Set<UUID> operatorIds = rows.stream().map(PlatformAuditLog::getPlatformOperatorId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, PlatformOperator> operatorsById = platformOperatorRepository.findAllById(operatorIds).stream()
                .collect(Collectors.toMap(PlatformOperator::getId, o -> o));

        Set<UUID> organizationIds = rows.stream().map(PlatformAuditLog::getOrganizationId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, Organization> organizationsById = organizationRepository.findAllById(organizationIds).stream()
                .collect(Collectors.toMap(Organization::getId, o -> o));

        return rows.stream().map(row -> {
            PlatformOperator operator = row.getPlatformOperatorId() != null
                    ? operatorsById.get(row.getPlatformOperatorId()) : null;
            Organization organization = row.getOrganizationId() != null
                    ? organizationsById.get(row.getOrganizationId()) : null;
            // Attempt against an unknown email leaves platformOperatorId
            // null (PlatformAuthService's own why-note) — "Unknown actor"
            // here is that honest, not the "row exists but the operator was
            // since deleted" case "Unknown operator" already covered.
            String operatorName = row.getPlatformOperatorId() == null ? "Unknown actor"
                    : operator != null ? operator.getFirstName() + " " + operator.getLastName() : "Unknown operator";
            return new PlatformAuditEntryView(
                    row.getId(),
                    row.getAction(),
                    row.getDetail(),
                    row.getCreatedAt(),
                    operatorName,
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

    public record PagedResult(List<PlatformAuditEntryView> items, int page, int size, long totalItems,
                               boolean hasMore) {
    }
}
