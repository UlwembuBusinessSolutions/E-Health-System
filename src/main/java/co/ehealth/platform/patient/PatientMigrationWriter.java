package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.Gender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// The destination-side half of PatientMigrationService.migrate() — split
// into its OWN bean rather than a private method on that orchestrator
// because @Transactional is proxy-based: a self-invocation (this.method()
// from another method on the same bean) bypasses the proxy entirely, and
// the annotation would be silently ignored. Called only after
// PatientMigrationService has already switched TenantContext to the
// destination schema, so every repository/service call in here resolves
// against the destination tenant automatically via the ambient search_path
// — this class never touches TenantContext itself.
@Service
public class PatientMigrationWriter {

    private final PatientRepository patientRepository;
    private final PatientDocumentService patientDocumentService;
    private final PatientMigrationRepository patientMigrationRepository;
    private final FacilityService facilityService;
    private final AuditLogService auditLogService;

    public PatientMigrationWriter(PatientRepository patientRepository,
                                   PatientDocumentService patientDocumentService,
                                   PatientMigrationRepository patientMigrationRepository,
                                   FacilityService facilityService, AuditLogService auditLogService) {
        this.patientRepository = patientRepository;
        this.patientDocumentService = patientDocumentService;
        this.patientMigrationRepository = patientMigrationRepository;
        this.facilityService = facilityService;
        this.auditLogService = auditLogService;
    }

    // All-or-nothing: the new Patient row, every copied document, and the
    // audit row either all commit or none do. If this throws partway
    // through, PatientMigrationService.migrate() never reaches its
    // origin-side finalize step (restore, then archive) — see that method's
    // own why-note on why that ordering is deliberate.
    @Transactional
    public DestinationWriteResult writeDestination(DestinationWriteCommand cmd) {
        // Confirms the chosen facility actually belongs to this (now-ambient)
        // destination tenant — throws FacilityNotFoundException (already
        // handled by GlobalExceptionHandler) if the id was never valid here.
        // Captured for the result, not just validated: PatientMigrationService's
        // migration email needs the facility name, and fetching it here
        // avoids a second TenantContext switch just for that.
        Facility destinationFacility = facilityService.get(cmd.destinationFacilityId());

        // The "returning patient" check — id_number is tenant-wide UNIQUE
        // (V8__patients.sql), so if this tenant already has a row for it,
        // blindly inserting a second one would just fail the constraint with
        // a bare 500-turned-409 further down. A hit here can only be this
        // exact person's own earlier record at this tenant (never a
        // coincidence), but it's only auto-reactivated when that record was
        // archived specifically BECAUSE this tenant migrated them out
        // before (a patient_migrations row for it) — never for an unrelated
        // reason like being marked deceased, which needs a human to sort
        // out instead (Patient.reactivateFromMigration()'s own why-note).
        Optional<Patient> existing = patientRepository.findByIdNumber(cmd.idNumber());
        Patient destinationPatient;
        boolean reactivated = false;
        if (existing.isPresent()) {
            Patient candidate = existing.get();
            if (!candidate.isArchived()) {
                throw new PatientAlreadyExistsAtDestinationException(
                        "This patient already has an active record at the destination organization.");
            }
            if (!patientMigrationRepository.existsByPatientId(candidate.getId())) {
                throw new PatientAlreadyExistsAtDestinationException(
                        "This patient already has an archived record at the destination organization that " +
                                "wasn't created by a migration — it needs to be reconciled manually before retrying.");
            }
            candidate.reactivateFromMigration(cmd.firstName(), cmd.lastName(), cmd.address(), cmd.contactNumber(),
                    cmd.email(), cmd.medicalAidProvider(), cmd.medicalAidNumber(), cmd.passportNumber(),
                    cmd.passportExpiry());
            patientRepository.save(candidate);
            // The old outbound link is stale the moment this person is back
            // — and patient_id is UNIQUE on patient_migrations, so it has to
            // go before this same record can ever migrate out of here again.
            patientMigrationRepository.findByPatientId(candidate.getId())
                    .ifPresent(patientMigrationRepository::delete);
            destinationPatient = candidate;
            reactivated = true;
        } else {
            String mpiNumber = MpiNumberFormat.generate(cmd.tenantCode(), patientRepository.nextMpiSequenceValue());
            destinationPatient = new Patient(mpiNumber, cmd.firstName(), cmd.lastName(), cmd.dateOfBirth(),
                    cmd.gender(), cmd.citizenshipStatus(), cmd.idNumber(), cmd.address(), cmd.contactNumber(),
                    cmd.email(), cmd.medicalAidProvider(), cmd.medicalAidNumber(), cmd.passportNumber(),
                    cmd.passportExpiry(), cmd.registeredByUserId(), cmd.now());
            patientRepository.save(destinationPatient);
        }

        for (PatientDocument original : cmd.documents()) {
            patientDocumentService.copyForMigration(original, destinationPatient.getId(), cmd.registeredByUserId(),
                    cmd.now());
        }

        // Deliberately not "PATIENT_REGISTERED" — this record didn't arrive
        // through the normal registration flow (PatientService.register()'s
        // own PREG:MANAGE check, run against THIS tenant's own staff, was
        // never evaluated here), so the audit trail should say so plainly.
        // Distinct action for the reactivation case — same entity, but a
        // very different event than a first-ever arrival.
        auditLogService.append(cmd.registeredByUserId(), cmd.destinationFacilityId(),
                reactivated ? "PATIENT_REACTIVATED_VIA_MIGRATION" : "PATIENT_RECEIVED_VIA_MIGRATION", "Patient",
                destinationPatient.getId().toString(), null, null);

        return new DestinationWriteResult(destinationPatient.getId(), destinationPatient.getMpiNumber(),
                destinationFacility.getName());
    }

    public record DestinationWriteCommand(String tenantCode, UUID destinationFacilityId, String firstName,
                                           String lastName, LocalDate dateOfBirth, Gender gender,
                                           CitizenshipStatus citizenshipStatus, String idNumber, String address,
                                           String contactNumber, String email, String medicalAidProvider,
                                           String medicalAidNumber, String passportNumber, LocalDate passportExpiry,
                                           UUID registeredByUserId, List<PatientDocument> documents, Instant now) {
    }

    public record DestinationWriteResult(UUID destinationPatientId, String destinationMpiNumber,
                                          String destinationFacilityName) {
    }
}
