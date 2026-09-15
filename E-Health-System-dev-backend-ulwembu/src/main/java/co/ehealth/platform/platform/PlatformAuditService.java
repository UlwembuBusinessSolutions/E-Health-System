package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.PlatformOperatorPrincipal;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// Platform-side audit trail service.
//
// Read operations are available to the platform audit controller.
// Audit records themselves are appended by the platform services that
// perform the corresponding actions.
//
// CSV export deliberately reuses the exact same search criteria as the
// platform audit listing endpoint so the exported data matches what the
// operator filtered on screen.
@Service
public class PlatformAuditService {

    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final PlatformOperatorRepository platformOperatorRepository;
    private final OrganizationRepository organizationRepository;

    public PlatformAuditService(
            PlatformAuditLogRepository platformAuditLogRepository,
            PlatformOperatorRepository platformOperatorRepository,
            OrganizationRepository organizationRepository) {

        this.platformAuditLogRepository = platformAuditLogRepository;
        this.platformOperatorRepository = platformOperatorRepository;
        this.organizationRepository = organizationRepository;
    }

    public List<PlatformAuditEntryView> list(
            String action,
            UUID organizationId,
            Instant from,
            Instant to) {

        Specification<PlatformAuditLog> spec =
                buildSpecification(action, organizationId, from, to);

        List<PlatformAuditLog> rows =
                platformAuditLogRepository.findAll(
                        spec,
                        Sort.by(Sort.Direction.DESC, "createdAt"));

        return toViews(rows);
    }

    /**
     * Generates the platform audit CSV using exactly the same filters as
     * the platform audit list endpoint.
     *
     * The export action itself is recorded in platform_audit_log.
     */
    @Transactional
    public AuditExport exportCsv(
            String action,
            UUID organizationId,
            Instant from,
            Instant to,
            UUID exportingOperatorId) {

        Specification<PlatformAuditLog> spec =
                buildSpecification(action, organizationId, from, to);

        List<PlatformAuditLog> rows =
                platformAuditLogRepository.findAll(
                        spec,
                        Sort.by(Sort.Direction.DESC, "createdAt"));

        List<PlatformAuditEntryView> items = toViews(rows);

        StringBuilder csv = new StringBuilder();

        csv.append("timestamp,action,operator,operatorEmail,organizationId,")
                .append("organizationName,detail,ipAddress,deviceSignature")
                .append("\r\n");

        for (PlatformAuditEntryView item : items) {
            appendCsvRow(
                    csv,
                    item.createdAt(),
                    item.action(),
                    item.operatorName(),
                    item.operatorEmail(),
                    item.organizationId(),
                    item.organizationName(),
                    item.detail(),
                    item.ipAddress(),
                    item.deviceSignature());
        }

        /*
         * Record the export itself after the CSV rows have been selected.
         *
         * The exported audit rows intentionally do not include this newly
         * created AUDIT_EXPORT row because that event did not exist at the
         * time the export dataset was assembled.
         */
        String detail = buildExportDetail(
                action,
                organizationId,
                from,
                to,
                items.size());

        /*
         * Use the authenticated platform operator from the security context.
         * PlatformJwtAuthenticationFilter places PlatformOperatorPrincipal
         * into SecurityContextHolder after validating the platform JWT.
         */
        UUID authenticatedOperatorId = authenticatedOperatorId();

        platformAuditLogRepository.save(
                new PlatformAuditLog(
                        authenticatedOperatorId,
                        "AUDIT_EXPORT",
                        organizationId,
                        detail,
                        Instant.now()));

        return new AuditExport(
                csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    private UUID authenticatedOperatorId() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null) {
            return null;
        }

        if (!(authentication.getPrincipal()
                instanceof PlatformOperatorPrincipal principal)) {
            return null;
        }

        return principal.operatorId();
    }

    private Specification<PlatformAuditLog> buildSpecification(
            String action,
            UUID organizationId,
            Instant from,
            Instant to) {

        Specification<PlatformAuditLog> spec =
                Specification.where(null);

        if (action != null && !action.isBlank()) {
            spec = spec.and(
                    (root, cq, cb) ->
                            cb.equal(root.get("action"), action));
        }

        if (organizationId != null) {
            spec = spec.and(
                    (root, cq, cb) ->
                            cb.equal(
                                    root.get("organizationId"),
                                    organizationId));
        }

        if (from != null) {
            spec = spec.and(
                    (root, cq, cb) ->
                            cb.greaterThanOrEqualTo(
                                    root.get("createdAt"),
                                    from));
        }

        if (to != null) {
            spec = spec.and(
                    (root, cq, cb) ->
                            cb.lessThan(
                                    root.get("createdAt"),
                                    to));
        }

        return spec;
    }

    private List<PlatformAuditEntryView> toViews(
            List<PlatformAuditLog> rows) {

        if (rows.isEmpty()) {
            return List.of();
        }

        Set<UUID> operatorIds =
                rows.stream()
                        .map(PlatformAuditLog::getPlatformOperatorId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());

        Map<UUID, PlatformOperator> operatorsById =
                platformOperatorRepository
                        .findAllById(operatorIds)
                        .stream()
                        .collect(Collectors.toMap(
                                PlatformOperator::getId,
                                operator -> operator));

        Set<UUID> organizationIds =
                rows.stream()
                        .map(PlatformAuditLog::getOrganizationId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet());

        Map<UUID, Organization> organizationsById =
                organizationRepository
                        .findAllById(organizationIds)
                        .stream()
                        .collect(Collectors.toMap(
                                Organization::getId,
                                organization -> organization));

        return rows.stream()
                .map(row -> {

                    PlatformOperator operator =
                            operatorsById.get(
                                    row.getPlatformOperatorId());

                    Organization organization =
                            row.getOrganizationId() != null
                                    ? organizationsById.get(
                                            row.getOrganizationId())
                                    : null;

                    return new PlatformAuditEntryView(
                            row.getId(),
                            row.getAction(),
                            row.getDetail(),
                            row.getCreatedAt(),
                            operator != null
                                    ? operator.getFirstName()
                                            + " "
                                            + operator.getLastName()
                                    : "Unknown operator",
                            operator != null
                                    ? operator.getEmail()
                                    : null,
                            row.getOrganizationId(),
                            organization != null
                                    ? organization.getDisplayName()
                                    : null,
                            row.getIpAddress(),
                            row.getDeviceSignature());
                })
                .toList();
    }

    private String buildExportDetail(
            String action,
            UUID organizationId,
            Instant from,
            Instant to,
            int rowCount) {

        return "filters: action=%s, organizationId=%s, from=%s, to=%s; rows=%d"
                .formatted(
                        action,
                        organizationId,
                        from,
                        to,
                        rowCount);
    }

    private void appendCsvRow(
            StringBuilder csv,
            Instant timestamp,
            String action,
            String operator,
            String operatorEmail,
            UUID organizationId,
            String organizationName,
            String detail,
            String ipAddress,
            String deviceSignature) {

        appendCsvValue(csv, timestamp);
        appendCsvValue(csv, action);
        appendCsvValue(csv, operator);
        appendCsvValue(csv, operatorEmail);
        appendCsvValue(csv, organizationId);
        appendCsvValue(csv, organizationName);
        appendCsvValue(csv, detail);
        appendCsvValue(csv, ipAddress);
        appendCsvValue(csv, deviceSignature);

        csv.append("\r\n");
    }

    private void appendCsvValue(
            StringBuilder csv,
            Object value) {

        if (value == null) {
            csv.append("\"\"");
            csv.append(",");
            return;
        }

        String text = String.valueOf(value);

        csv.append("\"")
                .append(text.replace("\"", "\"\""))
                .append("\"")
                .append(",");
    }

    public record AuditExport(byte[] content) {
    }

    public record PlatformAuditEntryView(
            UUID id,
            String action,
            String detail,
            Instant createdAt,
            String operatorName,
            String operatorEmail,
            UUID organizationId,
            String organizationName,
            String ipAddress,
            String deviceSignature) {
    }
}
