package co.ehealth.platform.patient;

import co.ehealth.platform.consultation.AllergyStatus;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.StockCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

// The patient's allergy record: the allergies themselves plus the overall status (unknown / no known
// allergies / known). Reading needs PREG:VIEW like the rest of the patient record; changing needs
// RECQ:MANAGE and a clinical role — the same gate ConsultationService uses for clinical documentation.
//
// Status rules, so the record can never contradict itself:
//   - recording an allergy makes the status KNOWN;
//   - "no known allergies" / "unknown" can only be set while no allergy is active;
//   - deactivating the last active allergy returns the status to UNKNOWN, never NONE_KNOWN: removing a
//     wrong entry is not the same as having asked the patient and been told "none".
@Service
public class PatientAllergyService {

    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");
    private static final String NOT_CLINICAL_ROLE_MESSAGE =
            "Only clinical staff (nurse, doctor, clinician, or occupational health practitioner) may change allergies.";

    private static final Pattern ATC = Pattern.compile("^[A-Z][0-9]{2}[A-Z]{2}([A-Z0-9]{1,2})?$");
    private static final Pattern REFERENCE_CODE = Pattern.compile("^[A-Z0-9][A-Z0-9._-]{0,19}$");
    private static final int MIN_REASON_LENGTH = 3;

    private final PatientRepository patientRepository;
    private final PatientAllergyRepository allergyRepository;
    private final PatientAllergyProfileRepository profileRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PharmacyProductRepository productRepository;

    public PatientAllergyService(PatientRepository patientRepository, PatientAllergyRepository allergyRepository,
                                 PatientAllergyProfileRepository profileRepository,
                                 PermissionService permissionService, AuditLogService auditLogService, Clock clock,
                                 PharmacyProductRepository productRepository) {
        this.patientRepository = patientRepository;
        this.allergyRepository = allergyRepository;
        this.profileRepository = profileRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.productRepository = productRepository;
    }

    public record AllergyCommand(String allergyCode, UUID catalogProductId, String allergyName, AllergenType allergenType, String reaction,
                                 AllergySeverity severity, LocalDate dateIdentified, String clinicalNotes) {
    }

    public record AllergyRecord(AllergyStatus status, Instant statusUpdatedAt, List<PatientAllergy> allergies) {
        public long activeCount() {
            return allergies.stream().filter(PatientAllergy::isActive).count();
        }
    }

    @Transactional(readOnly = true)
    public AllergyRecord get(UUID patientId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        requirePatient(patientId);
        return buildRecord(patientId);
    }

    @Transactional
    public PatientAllergy add(UUID patientId, AllergyCommand cmd, UUID userId) {
        requireWriteAccess();
        requireNotArchived(patientId);
        AllergyCommand clean = validate(cmd);
        requireNoActiveDuplicate(patientId, null, clean);
        Instant now = clock.instant();
        PatientAllergy allergy = allergyRepository.save(new PatientAllergy(patientId, clean.allergyCode(), clean.catalogProductId(),
                clean.allergyName(), clean.allergenType(), clean.reaction(), clean.severity(),
                clean.dateIdentified(), clean.clinicalNotes(), userId, now));
        saveStatus(patientId, AllergyStatus.KNOWN, userId, now);
        audit(userId, "PATIENT_ALLERGY_ADDED", allergy);
        return allergy;
    }

    @Transactional
    public PatientAllergy update(UUID patientId, UUID allergyId, AllergyCommand cmd, UUID userId) {
        requireWriteAccess();
        requireNotArchived(patientId);
        PatientAllergy allergy = getOwned(patientId, allergyId);
        if (!allergy.isActive()) {
            throw new InvalidPatientAllergyException("This allergy is inactive. Reactivate it before editing.");
        }
        AllergyCommand clean = validate(cmd);
        requireNoActiveDuplicate(patientId, allergyId, clean);
        allergy.update(clean.allergyCode(), clean.catalogProductId(), clean.allergyName(), clean.allergenType(), clean.reaction(),
                clean.severity(), clean.dateIdentified(), clean.clinicalNotes(), userId, clock.instant());
        PatientAllergy saved = allergyRepository.save(allergy);
        audit(userId, "PATIENT_ALLERGY_UPDATED", saved);
        return saved;
    }

    @Transactional
    public PatientAllergy deactivate(UUID patientId, UUID allergyId, String reason, UUID userId) {
        requireWriteAccess();
        requireNotArchived(patientId);
        PatientAllergy allergy = getOwned(patientId, allergyId);
        if (!allergy.isActive()) {
            throw new InvalidPatientAllergyException("This allergy is already inactive.");
        }
        String cleanReason = reason == null ? "" : reason.trim();
        if (cleanReason.length() < MIN_REASON_LENGTH) {
            throw new InvalidPatientAllergyException("Give a reason for marking this allergy inactive.");
        }
        Instant now = clock.instant();
        allergy.deactivate(cleanReason, userId, now);
        PatientAllergy saved = allergyRepository.save(allergy);
        boolean anyActive = allergyRepository.findByPatientId(patientId).stream().anyMatch(PatientAllergy::isActive);
        if (!anyActive) {
            saveStatus(patientId, AllergyStatus.UNKNOWN, userId, now);
        }
        audit(userId, "PATIENT_ALLERGY_DEACTIVATED", saved);
        return saved;
    }

    @Transactional
    public PatientAllergy reactivate(UUID patientId, UUID allergyId, UUID userId) {
        requireWriteAccess();
        requireNotArchived(patientId);
        PatientAllergy allergy = getOwned(patientId, allergyId);
        if (allergy.isActive()) {
            throw new InvalidPatientAllergyException("This allergy is already active.");
        }
        requireNoActiveDuplicate(patientId, allergyId, new AllergyCommand(allergy.getAllergyCode(), allergy.getCatalogProductId(),
                allergy.getAllergyName(), allergy.getAllergenType(), allergy.getReaction(), allergy.getSeverity(),
                allergy.getDateIdentified(), allergy.getClinicalNotes()));
        Instant now = clock.instant();
        allergy.reactivate(userId, now);
        PatientAllergy saved = allergyRepository.save(allergy);
        saveStatus(patientId, AllergyStatus.KNOWN, userId, now);
        audit(userId, "PATIENT_ALLERGY_REACTIVATED", saved);
        return saved;
    }

    // Records "no known allergies" or "unknown". KNOWN is never set directly — it follows from recording an allergy.
    @Transactional
    public AllergyRecord setStatus(UUID patientId, AllergyStatus status, UUID userId) {
        requireWriteAccess();
        requireNotArchived(patientId);
        if (status == AllergyStatus.KNOWN) {
            throw new InvalidPatientAllergyException(
                    "Record an allergy to mark the patient as having known allergies.");
        }
        boolean anyActive = allergyRepository.findByPatientId(patientId).stream().anyMatch(PatientAllergy::isActive);
        if (anyActive) {
            throw new InvalidPatientAllergyException(
                    "This patient has active allergies. Mark them inactive first.");
        }
        saveStatus(patientId, status, userId, clock.instant());
        auditLogService.append(userId, null, "PATIENT_ALLERGY_STATUS_SET", "Patient", patientId.toString(), null, null);
        return buildRecord(patientId);
    }

    private AllergyRecord buildRecord(UUID patientId) {
        List<PatientAllergy> allergies = allergyRepository.findByPatientId(patientId).stream()
                .sorted(Comparator.comparing(PatientAllergy::isActive).reversed()
                        .thenComparing((PatientAllergy a) -> a.getSeverity().ordinal(), Comparator.reverseOrder())
                        .thenComparing(PatientAllergy::getCreatedAt, Comparator.reverseOrder()))
                .toList();
        PatientAllergyProfile profile = profileRepository.findById(patientId).orElse(null);
        boolean anyActive = allergies.stream().anyMatch(PatientAllergy::isActive);
        AllergyStatus stored = profile == null ? AllergyStatus.UNKNOWN : profile.getStatus();
        // Derived, so a stored KNOWN with nothing active (or active allergies under a stale NONE_KNOWN) can
        // never be shown to a clinician.
        AllergyStatus status = anyActive ? AllergyStatus.KNOWN
                : stored == AllergyStatus.KNOWN ? AllergyStatus.UNKNOWN : stored;
        return new AllergyRecord(status, profile == null ? null : profile.getUpdatedAt(), allergies);
    }

    private void saveStatus(UUID patientId, AllergyStatus status, UUID userId, Instant now) {
        PatientAllergyProfile profile = profileRepository.findById(patientId).orElse(null);
        if (profile == null) {
            profileRepository.save(new PatientAllergyProfile(patientId, status, userId, now));
        } else {
            profile.changeStatus(status, userId, now);
            profileRepository.save(profile);
        }
    }

    private AllergyCommand validate(AllergyCommand cmd) {
        String name = trimToNull(cmd.allergyName());
        if (name == null) throw new InvalidPatientAllergyException("Enter the allergy name or description.");
        if (name.length() > 200) throw new InvalidPatientAllergyException("The allergy name is too long.");
        if (cmd.allergenType() == null) throw new InvalidPatientAllergyException("Choose the allergen type.");
        String reaction = trimToNull(cmd.reaction());
        if (reaction == null) throw new InvalidPatientAllergyException("Enter the reaction or symptoms.");
        if (reaction.length() > 500) throw new InvalidPatientAllergyException("The reaction is too long.");
        if (cmd.severity() == null) throw new InvalidPatientAllergyException("Choose the severity.");
        if (cmd.dateIdentified() == null) throw new InvalidPatientAllergyException("Enter the date identified.");
        // One day of slack: the browser's "today" can be ahead of the server's in another time zone.
        if (cmd.dateIdentified().isAfter(LocalDate.now(clock).plusDays(1))) {
            throw new InvalidPatientAllergyException("The date identified cannot be in the future.");
        }
        String notes = trimToNull(cmd.clinicalNotes());
        if (notes != null && notes.length() > 2000) {
            throw new InvalidPatientAllergyException("The clinical notes are too long.");
        }
        String code = trimToNull(cmd.allergyCode());
        code = code == null ? null : code.toUpperCase(Locale.ROOT);
        PharmacyProduct linkedProduct = null;
        if (cmd.catalogProductId() != null) {
            linkedProduct = productRepository.findById(cmd.catalogProductId())
                    .filter(PharmacyProduct::isActive)
                    .orElseThrow(() -> new InvalidPatientAllergyException("Choose an active catalogue product."));
        }
        if (cmd.allergenType() == AllergenType.MEDICATION) {
            if (linkedProduct != null && linkedProduct.getCategory() != StockCategory.MEDICINE) {
                throw new InvalidPatientAllergyException("Medication allergies must link to a medicine product.");
            }
            if (code == null && linkedProduct != null) code = linkedProduct.getAtcCode();
            if (code == null && linkedProduct == null || code != null && !ATC.matcher(code).matches()) {
                throw new InvalidPatientAllergyException(
                        "Choose a catalogue medicine or enter a valid ATC code so prescribing can be checked.");
            }
            if (linkedProduct != null && linkedProduct.getAtcCode() != null) code = linkedProduct.getAtcCode();
        } else if (linkedProduct != null && linkedProduct.getCategory() == StockCategory.MEDICINE) {
            throw new InvalidPatientAllergyException("Choose a supply or device for an Other allergy.");
        } else if (code != null && !REFERENCE_CODE.matcher(code).matches()) {
            throw new InvalidPatientAllergyException(
                    "The allergy code may only contain letters, digits, dots, dashes and underscores (20 characters at most).");
        }
        return new AllergyCommand(code, cmd.catalogProductId(), name, cmd.allergenType(), reaction, cmd.severity(), cmd.dateIdentified(), notes);
    }

    // The same allergen recorded twice would only hide which entry is the current one.
    private void requireNoActiveDuplicate(UUID patientId, UUID ignoreId, AllergyCommand cmd) {
        boolean duplicate = allergyRepository.findByPatientId(patientId).stream()
                .filter(PatientAllergy::isActive)
                .filter(a -> !a.getId().equals(ignoreId))
                .anyMatch(a -> a.getAllergenType() == cmd.allergenType()
                        && (a.getAllergyName().equalsIgnoreCase(cmd.allergyName())
                        || (cmd.allergyCode() != null && cmd.allergyCode().equalsIgnoreCase(a.getAllergyCode()))));
        if (duplicate) {
            throw new InvalidPatientAllergyException("This allergy is already recorded for the patient.");
        }
    }

    private void requireWriteAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, NOT_CLINICAL_ROLE_MESSAGE);
    }

    private void requirePatient(UUID patientId) {
        if (!patientRepository.existsById(patientId)) {
            throw new PatientNotFoundException();
        }
    }

    // Same rule as guardians and documents: an archived record has every edit control disabled.
    private void requireNotArchived(UUID patientId) {
        Patient patient = patientRepository.findById(patientId).orElseThrow(PatientNotFoundException::new);
        if (patient.isArchived()) {
            throw new PatientArchivedException();
        }
    }

    // The allergy must belong to the patient in the URL — a mismatch is a 404, never another patient's record.
    private PatientAllergy getOwned(UUID patientId, UUID allergyId) {
        PatientAllergy allergy = allergyRepository.findById(allergyId).orElseThrow(PatientAllergyNotFoundException::new);
        if (!allergy.getPatientId().equals(patientId)) {
            throw new PatientAllergyNotFoundException();
        }
        return allergy;
    }

    // before/after are always null: audit_log.before_value/after_value are JSONB, so a plain sentence there fails
    // with "invalid input syntax for type json" and rolls the whole save back (same rule as every other
    // auditLogService.append() call site — see PatientService). The entity id plus the action is the trail.
    private void audit(UUID userId, String action, PatientAllergy allergy) {
        auditLogService.append(userId, null, action, "PatientAllergy", allergy.getId().toString(), null, null);
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
