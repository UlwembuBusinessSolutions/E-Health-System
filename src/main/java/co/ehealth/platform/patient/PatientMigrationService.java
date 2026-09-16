package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Cross-tenant patient migration — the first feature in this codebase to
// deliberately cross a tenant schema boundary from WITHIN an already
// tenant-scoped request (every prior TenantContext.setCurrentTenant() call
// site, all in OrganizationProvisioningService, runs from the platform-
// operator layer where no tenant was ever ambient to begin with — see
// TenantContext's own class comment). Every method below that switches
// tenants restores the origin schema in its own finally rather than calling
// TenantContext.clear() — the request is still origin-tenant-authenticated
// throughout, and TenantFilter's own outer finally clears it unconditionally
// at the true end of the request regardless.
//
// Deliberately NOT @Transactional at the class or migrate() method level:
// a migration spans two schemas, which under Hibernate's schema-based
// multi-tenancy means two separate JDBC connections — one Spring transaction
// can't cover both (same reasoning OrganizationProvisioningService.provisionOrganization()'s
// own why-note gives for not wrapping its own cross-schema work in one).
@Service
public class PatientMigrationService {

    private final PatientRepository patientRepository;
    private final PatientDocumentRepository patientDocumentRepository;
    private final PatientDocumentService patientDocumentService;
    private final PatientMigrationRepository patientMigrationRepository;
    private final PatientMigrationWriter patientMigrationWriter;
    private final OrganizationRepository organizationRepository;
    private final FacilityService facilityService;
    private final AuditLogService auditLogService;
    private final EmailService emailService;
    private final PermissionService permissionService;
    private final Clock clock;

    public PatientMigrationService(PatientRepository patientRepository,
                                    PatientDocumentRepository patientDocumentRepository,
                                    PatientDocumentService patientDocumentService,
                                    PatientMigrationRepository patientMigrationRepository,
                                    PatientMigrationWriter patientMigrationWriter,
                                    OrganizationRepository organizationRepository, FacilityService facilityService,
                                    AuditLogService auditLogService, EmailService emailService,
                                    PermissionService permissionService, Clock clock) {
        this.patientRepository = patientRepository;
        this.patientDocumentRepository = patientDocumentRepository;
        this.patientDocumentService = patientDocumentService;
        this.patientMigrationRepository = patientMigrationRepository;
        this.patientMigrationWriter = patientMigrationWriter;
        this.organizationRepository = organizationRepository;
        this.facilityService = facilityService;
        this.auditLogService = auditLogService;
        this.emailService = emailService;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    // The destination-organization picker — id + displayName only
    // (PatientController.MigrationOrganizationSummary's own why-note),
    // excludes the caller's own organization and anything not ACTIVE. No
    // TenantContext switch needed: Organization is control-schema, always
    // reachable regardless of the ambient search_path.
    public List<Organization> listDestinationOrganizations() {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        Organization own = organizationRepository.findBySchemaName(TenantContext.getCurrentTenant())
                .orElseThrow(() -> new IllegalStateException("Unknown organization for current tenant"));
        return organizationRepository.findByStatusAndIdNot(OrganizationStatus.ACTIVE, own.getId());
    }

    // The dependent facility picker, once a destination organization is
    // chosen — Facility is per-tenant (unlike Organization), so this is the
    // first read in the whole flow that actually needs the switch-and-
    // restore. Not @Transactional: the switch below must happen as plain
    // code before facilityService.list() opens its own transaction/connection
    // — if this method were @Transactional, Spring's proxy would check out a
    // connection at method ENTRY, before TenantContext is flipped, and
    // facilityService.list() would silently read the wrong tenant's
    // facilities (same connection-checkout-timing rule TenantConnectionProvider
    // enforces for every tenant switch in this codebase).
    public List<Facility> listDestinationFacilities(UUID destinationOrganizationId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        String originSchema = TenantContext.getCurrentTenant();
        Organization destination = requireValidDestination(destinationOrganizationId, originSchema);

        TenantContext.setCurrentTenant(destination.getSchemaName());
        try {
            return facilityService.list().stream().filter(Facility::isActive).toList();
        } finally {
            TenantContext.setCurrentTenant(originSchema);
        }
    }

    // The migration itself. Destination-write-first, origin-finalize-second
    // — deliberate ordering: if the process dies between the two, the result
    // is a stray duplicate Patient row at the destination with the origin
    // still showing active, recoverable by manual reconciliation (compare
    // this tenant's own patient_migrations rows against the destination's
    // "PATIENT_RECEIVED_VIA_MIGRATION" audit rows). The reverse order —
    // marking the origin migrated before the destination write is confirmed
    // — risks losing the patient's record entirely if the destination write
    // then fails, which is strictly worse. Same class of accepted
    // non-atomicity OrganizationProvisioningService.provisionOrganization()
    // already lives with for its own cross-schema sequence.
    public MigrationResult migrate(UUID patientId, MigratePatientCommand cmd, UUID actingUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        Patient patient = patientRepository.findById(patientId).orElseThrow(PatientNotFoundException::new);
        if (patient.isArchived()) {
            // Covers both "already archived" and "already migrated" — a
            // migrated patient is always archived (this method's own
            // archive() call below), so one guard covers the one-way,
            // no-re-migration guarantee too.
            throw new PatientArchivedException();
        }

        String originSchema = TenantContext.getCurrentTenant();
        Organization destinationOrganization = requireValidDestination(cmd.destinationOrganizationId(), originSchema);

        // Read while still origin-scoped, before the switch below.
        List<PatientDocument> documents = patientDocumentRepository.findByPatientIdOrderByUploadedAtDesc(patientId);
        Instant now = clock.instant();

        PatientMigrationWriter.DestinationWriteResult result;
        TenantContext.setCurrentTenant(destinationOrganization.getSchemaName());
        try {
            result = patientMigrationWriter.writeDestination(new PatientMigrationWriter.DestinationWriteCommand(
                    destinationOrganization.getTenantCode(), cmd.destinationFacilityId(), patient.getFirstName(),
                    patient.getLastName(), patient.getDateOfBirth(), patient.getGender(),
                    patient.getCitizenshipStatus(), patient.getIdNumber(), patient.getAddress(),
                    patient.getContactNumber(), patient.getEmail(), patient.getMedicalAidProvider(),
                    patient.getMedicalAidNumber(), patient.getPassportNumber(), patient.getPassportExpiry(),
                    actingUserId, documents, now));
        } finally {
            // Restore, not clear() — this request is still origin-tenant-
            // authenticated and has more origin-schema work below (see class
            // comment).
            TenantContext.setCurrentTenant(originSchema);
        }

        // Origin finalize — only reached once the destination write above has
        // fully returned. Re-fetches rather than reusing the earlier `patient`
        // reference in case anything changed it during the (however brief)
        // window the switch was active on another connection/thread.
        Patient fresh = patientRepository.findById(patientId).orElseThrow(PatientNotFoundException::new);
        if (fresh.isArchived()) {
            throw new PatientAlreadyArchivedException();
        }
        // Calls Patient.archive() directly, not patientService.archive() —
        // that method writes a generic "PATIENT_ARCHIVED" audit row; this
        // flow writes its own distinct "PATIENT_MIGRATED_OUT" row below
        // instead (Patient.archive()'s own why-note on this).
        fresh.archive("Migrated to " + destinationOrganization.getDisplayName(), null, actingUserId, now);
        patientRepository.save(fresh);
        patientMigrationRepository.save(new PatientMigration(fresh.getId(), destinationOrganization.getId(),
                result.destinationPatientId(), cmd.destinationFacilityId(), cmd.reason(), actingUserId, now));
        // facilityId is null, same as every other patient-level audit row in
        // this module (PatientService.register()/update()/archive()'s own
        // pattern) — a Patient isn't tied to one facility, and
        // cmd.destinationFacilityId() specifically belongs to a DIFFERENT
        // tenant's own facilities table, so it would be actively misleading
        // in this (origin) tenant's audit_log if it were used here instead.
        // It's captured in the detail JSON below alongside the destination
        // organization for traceability.
        auditLogService.append(actingUserId, null, "PATIENT_MIGRATED_OUT", "Patient", fresh.getId().toString(), null,
                "{\"destinationOrganizationId\":\"%s\",\"destinationFacilityId\":\"%s\"}"
                        .formatted(destinationOrganization.getId(), cmd.destinationFacilityId()));

        // Best-effort, after both writes have succeeded — never blocks or
        // rolls back the migration itself (EmailService's own swallow-
        // failure design), and silently skipped when there's no email on
        // file at all (decision #4).
        if (fresh.getEmail() != null) {
            emailService.sendPatientMigratedEmail(fresh.getEmail(), fresh.getFirstName(),
                    destinationOrganization.getDisplayName(), result.destinationFacilityName(),
                    result.destinationMpiNumber());
        }

        return new MigrationResult(result.destinationPatientId(), result.destinationMpiNumber());
    }

    // PatientController.get()'s own migrated flag — cheap existence check,
    // only ever called for a patient already known to be archived (that
    // controller's own why-note).
    public boolean isMigrated(UUID patientId) {
        return patientMigrationRepository.existsByPatientId(patientId);
    }

    // The "full ongoing access" read (decision #3) — origin staff viewing
    // the LIVE destination record, not a frozen snapshot. Authorization is
    // structural, not a separate ACL: {patientId} only ever resolves within
    // the caller's own schema (a different tenant's patient UUID simply
    // isn't found here), and a real PatientMigration row for this exact
    // patient is additionally required — there is no "which destination"
    // parameter, so this can't be pointed at an arbitrary other tenant.
    public DestinationView getDestinationView(UUID patientId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        if (!patientRepository.existsById(patientId)) {
            throw new PatientNotFoundException();
        }
        PatientMigration migration = patientMigrationRepository.findByPatientId(patientId)
                .orElseThrow(MigrationNotFoundException::new);

        String originSchema = TenantContext.getCurrentTenant();
        Organization destination = organizationRepository.findById(migration.getDestinationOrganizationId())
                .orElseThrow(() -> new IllegalStateException("Destination organization no longer exists"));

        TenantContext.setCurrentTenant(destination.getSchemaName());
        try {
            Patient destinationPatient = patientRepository.findById(migration.getDestinationPatientId())
                    .orElseThrow(() -> new IllegalStateException("Destination patient record missing"));
            List<PatientDocument> destinationDocuments =
                    patientDocumentRepository.findByPatientIdOrderByUploadedAtDesc(destinationPatient.getId());
            Facility destinationFacility = facilityService.get(migration.getDestinationFacilityId());
            return new DestinationView(destinationPatient, destinationDocuments, destination.getDisplayName(),
                    destinationFacility.getName());
        } finally {
            TenantContext.setCurrentTenant(originSchema);
        }
    }

    // The document-download half of the destination view — same switch-and-
    // restore shape as getDestinationView() above, just resolving one S3 key
    // instead of the whole record. Presigning itself needs no TenantContext
    // (it only ever talks to S3, not Postgres), so it happens after restore.
    public String getDestinationDocumentDownloadUrl(UUID patientId, UUID documentId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        if (!patientRepository.existsById(patientId)) {
            throw new PatientNotFoundException();
        }
        PatientMigration migration = patientMigrationRepository.findByPatientId(patientId)
                .orElseThrow(MigrationNotFoundException::new);

        String originSchema = TenantContext.getCurrentTenant();
        Organization destination = organizationRepository.findById(migration.getDestinationOrganizationId())
                .orElseThrow(() -> new IllegalStateException("Destination organization no longer exists"));

        String s3Key;
        TenantContext.setCurrentTenant(destination.getSchemaName());
        try {
            PatientDocument document = patientDocumentRepository.findById(documentId)
                    .orElseThrow(PatientDocumentNotFoundException::new);
            if (!document.getPatientId().equals(migration.getDestinationPatientId())) {
                throw new PatientDocumentNotFoundException();
            }
            s3Key = document.getS3Key();
        } finally {
            TenantContext.setCurrentTenant(originSchema);
        }
        return patientDocumentService.presign(s3Key);
    }

    private Organization requireValidDestination(UUID destinationOrganizationId, String originSchema) {
        Organization destination = organizationRepository.findById(destinationOrganizationId)
                .filter(o -> o.getStatus() == OrganizationStatus.ACTIVE)
                .orElseThrow(InvalidMigrationDestinationException::new);
        if (destination.getSchemaName().equals(originSchema)) {
            throw new InvalidMigrationDestinationException();
        }
        return destination;
    }

    public record MigratePatientCommand(UUID destinationOrganizationId, UUID destinationFacilityId, String reason) {
    }

    public record MigrationResult(UUID destinationPatientId, String destinationMpiNumber) {
    }

    public record DestinationView(Patient patient, List<PatientDocument> documents,
                                   String destinationOrganizationDisplayName, String destinationFacilityName) {
    }
}
