package co.ehealth.platform.core.audit;

import co.ehealth.platform.core.common.RequestMetadata;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Predicate;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final Clock clock;
    private final String exportSigningSecret;

    public AuditLogService(
            AuditLogRepository auditLogRepository,
            Clock clock,
            @Value("${app.audit.export-signing-secret}")
            String exportSigningSecret) {

        this.auditLogRepository = auditLogRepository;
        this.clock = clock;
        this.exportSigningSecret = exportSigningSecret;
    }

    public List<AuditLog> listAll() {
        return auditLogRepository.findAll(
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    /**
     * Generates a CSV export from exactly the audit records selected by
     * the supplied filters.
     *
     * The export contains:
     * - exporting user
     * - generation timestamp
     * - filtered audit records
     * - SHA-256 evidence hash
     * - HMAC-SHA256 signature
     *
     * Export generation itself is recorded as an AUDIT_EXPORT event.
     */
    public AuditExport exportCsv(AuditLogSearchCriteria criteria) {

        List<AuditLog> logs = search(criteria);

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        String exportedBy =
                authentication != null
                        ? authentication.getName()
                        : "SYSTEM";

        Instant generatedAt = clock.instant();

        StringBuilder csv = new StringBuilder();

        csv.append("Exported By,")
                .append(csvValue(exportedBy))
                .append("\n");

        csv.append("Generated At,")
                .append(csvValue(generatedAt))
                .append("\n");

        csv.append("Record Count,")
                .append(logs.size())
                .append("\n\n");

        csv.append(
                "Audit Sequence,Timestamp,Action,User ID,Facility ID,"
                        + "Entity Type,Entity ID,Privileged,Before Value,"
                        + "After Value,IP Address,Device Signature,Previous Hash,"
                        + "Integrity Hash")
                .append("\n");

        for (AuditLog log : logs) {

            csv.append(csvValue(log.getAuditSequence()))
                    .append(',')
                    .append(csvValue(log.getCreatedAt()))
                    .append(',')
                    .append(csvValue(log.getAction()))
                    .append(',')
                    .append(csvValue(log.getUserId()))
                    .append(',')
                    .append(csvValue(log.getFacilityId()))
                    .append(',')
                    .append(csvValue(log.getEntityType()))
                    .append(',')
                    .append(csvValue(log.getEntityId()))
                    .append(',')
                    .append(csvValue(log.isPrivileged()))
                    .append(',')
                    .append(csvValue(log.getBeforeValue()))
                    .append(',')
                    .append(csvValue(log.getAfterValue()))
                    .append(',')
                    .append(csvValue(log.getIpAddress()))
                    .append(',')
                    .append(csvValue(log.getDeviceSignature()))
                    .append(',')
                    .append(csvValue(log.getPreviousHash()))
                    .append(',')
                    .append(csvValue(log.getIntegrityHash()))
                    .append('\n');
        }

        byte[] unsignedContent =
                csv.toString().getBytes(StandardCharsets.UTF_8);

        String exportHash = sha256(unsignedContent);

        String exportSignature =
                hmacSha256(exportHash);

        csv.insert(
                0,
                "Export Hash,"
                        + exportHash
                        + "\n"
                        + "Export Signature,"
                        + exportSignature
                        + "\n");

        String exportMetadata =
                """
                {
                  "recordCount": %d,
                  "exportedBy": "%s",
                  "generatedAt": "%s",
                  "sha256": "%s",
                  "signature": "%s"
                }
                """.formatted(
                        logs.size(),
                        exportedBy,
                        generatedAt,
                        exportHash,
                        exportSignature);

        UUID exportingUserId = authenticatedUserId();

        UUID facilityId =
                logs.stream()
                        .map(AuditLog::getFacilityId)
                        .filter(Objects::nonNull)
                        .findFirst()
                        .orElse(null);

        append(
                exportingUserId,
                facilityId,
                "AUDIT_EXPORT",
                "AUDIT_LOG",
                String.valueOf(logs.size()),
                null,
                exportMetadata,
                isPrivilegedCaller());

        return new AuditExport(
                csv.toString().getBytes(StandardCharsets.UTF_8),
                generatedAt,
                exportedBy,
                logs.size(),
                exportHash);
    }

    public List<AuditLog> search(AuditLogSearchCriteria criteria) {

        if (criteria == null) {
            return listAll();
        }

        Predicate<AuditLog> filter = row -> true;

        if (criteria.from() != null) {
            filter = filter.and(row ->
                    !row.getCreatedAt().isBefore(criteria.from()));
        }

        if (criteria.to() != null) {
            filter = filter.and(row ->
                    row.getCreatedAt().isBefore(criteria.to()));
        }

        if (criteria.userId() != null) {
            filter = filter.and(row ->
                    criteria.userId().equals(row.getUserId()));
        }

        if (criteria.action() != null
                && !criteria.action().isBlank()) {

            String action = criteria.action().trim();

            filter = filter.and(row ->
                    action.equalsIgnoreCase(row.getAction()));
        }

        if (criteria.entityId() != null
                && !criteria.entityId().isBlank()) {

            String entityId = criteria.entityId().trim();

            filter = filter.and(row ->
                    entityId.equals(row.getEntityId()));
        }

        if (criteria.privileged() != null) {
            filter = filter.and(row ->
                    criteria.privileged().equals(row.isPrivileged()));
        }

        /*
         * AuditLog does not currently persist ModuleCode.
         *
         * Do not infer a module from the action name. The module filter
         * remains part of the API contract but cannot be applied until
         * audit records have an authoritative module value.
         */
        return listAll()
                .stream()
                .filter(filter)
                .toList();
    }

    /**
     * Existing audit write path.
     *
     * Existing callers remain compatible and create a non-privileged
     * audit event unless they explicitly use the overload below.
     */
    public void append(
            UUID userId,
            UUID facilityId,
            String action,
            String entityType,
            String entityId,
            String beforeValue,
            String afterValue) {

        append(
                userId,
                facilityId,
                action,
                entityType,
                entityId,
                beforeValue,
                afterValue,
                false);
    }

    /**
     * Audit write path with explicit privilege classification.
     */
    public void append(
            UUID userId,
            UUID facilityId,
            String action,
            String entityType,
            String entityId,
            String beforeValue,
            String afterValue,
            boolean privileged) {

        auditLogRepository.save(
                new AuditLog(
                        userId,
                        facilityId,
                        action,
                        entityType,
                        entityId,
                        beforeValue,
                        afterValue,
                        RequestMetadata.currentIpAddress(),
                        RequestMetadata.currentUserAgent(),
                        privileged,
                        clock.instant()));
    }

    private UUID authenticatedUserId() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null) {
            return null;
        }

        if (!(authentication.getPrincipal()
                instanceof AuthenticatedPrincipal principal)) {
            return null;
        }

        return principal.userId();
    }

    private boolean isPrivilegedCaller() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null
                || !(authentication.getPrincipal()
                instanceof AuthenticatedPrincipal)) {

            return false;
        }

        return authentication.getAuthorities()
                .stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ORG_ADMIN"::equals);
    }

    private static String sha256(byte[] content) {

        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            return HexFormat.of()
                    .formatHex(digest.digest(content));

        } catch (Exception e) {
            throw new IllegalStateException(
                    "Unable to generate export hash",
                    e);
        }
    }

    private String hmacSha256(String content) {

        try {
            Mac mac = Mac.getInstance("HmacSHA256");

            SecretKeySpec key =
                    new SecretKeySpec(
                            exportSigningSecret.getBytes(StandardCharsets.UTF_8),
                            "HmacSHA256");

            mac.init(key);

            return HexFormat.of()
                    .formatHex(
                            mac.doFinal(
                                    content.getBytes(StandardCharsets.UTF_8)));

        } catch (Exception e) {
            throw new IllegalStateException(
                    "Unable to generate audit export signature",
                    e);
        }
    }

    private static String csvValue(Object value) {

        if (value == null) {
            return "";
        }

        String text = String.valueOf(value);

        boolean requiresQuotes =
                text.contains(",")
                        || text.contains("\"")
                        || text.contains("\r")
                        || text.contains("\n");

        if (text.contains("\"")) {
            text = text.replace("\"", "\"\"");
        }

        return requiresQuotes
                ? "\"" + text + "\""
                : text;
    }

    public record AuditExport(
            byte[] content,
            Instant generatedAt,
            String exportedBy,
            int recordCount,
            String sha256) {
    }

    public record AuditLogSearchCriteria(
            Instant from,
            Instant to,
            UUID userId,
            String action,
            ModuleCode module,
            String entityId,
            Boolean privileged) {
    }
}