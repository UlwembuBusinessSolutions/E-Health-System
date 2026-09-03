package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.Gender;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class PatientService {

    private final PatientRepository patientRepository;
    private final PatientFieldHistoryRepository fieldHistoryRepository;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final PermissionService permissionService;

    public PatientService(PatientRepository patientRepository, PatientFieldHistoryRepository fieldHistoryRepository,
                           AuditLogService auditLogService, Clock clock, PermissionService permissionService) {
        this.patientRepository = patientRepository;
        this.fieldHistoryRepository = fieldHistoryRepository;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.permissionService = permissionService;
    }

    // PREG-US-001: "an EPR is created and a unique MPI number is
    // generated ... the patient is immediately available in search and an
    // AUDT PATIENT_REGISTERED event is recorded." idNumber is the only
    // identity input the form takes — dateOfBirth/gender/citizenship all
    // come from SouthAfricanIdNumber.parse(), never from the request
    // directly, so there's no way for a caller to submit a DOB that
    // disagrees with the ID number it was supposedly derived from.
    @Transactional
    public Patient register(RegisterPatientCommand cmd, UUID registeredByUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        if (patientRepository.existsByIdNumber(cmd.idNumber())) {
            throw new DuplicateFieldException("idNumber", "A patient with this ID number is already registered.");
        }
        SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse(cmd.idNumber());

        String mpiNumber = "MPI-" + String.format("%07d", patientRepository.nextMpiSequenceValue());
        Patient patient = new Patient(mpiNumber, cmd.firstName(), cmd.lastName(), parsed.dateOfBirth(),
                parsed.gender(), parsed.citizenshipStatus(), cmd.idNumber(), cmd.address(), cmd.contactNumber(),
                cmd.medicalAidProvider(), cmd.medicalAidNumber(), cmd.passportNumber(), cmd.passportExpiry(),
                registeredByUserId, clock.instant());
        patientRepository.save(patient);

        auditLogService.append(registeredByUserId, null, "PATIENT_REGISTERED", "Patient",
                patient.getId().toString(), null, null);

        return patient;
    }

    public Patient get(UUID id) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        return patientRepository.findById(id).orElseThrow(PatientNotFoundException::new);
    }

    // PREG-US-016 — edit access is gated twice: SecurityConfig's own
    // /api/v1/admin/** -> hasRole("ORG_ADMIN") matcher on the controller
    // side (PatientController.update()'s own why-note), and this
    // module-permission check here, same as every other PatientService
    // method. ORG_ADMIN already carries PREG:MANAGE by default (V12's own
    // seed), so in practice this is belt-and-suspenders, not two
    // independent gates. Fields that don't actually change produce no
    // history row and no audit entry — a submit that changes nothing is a
    // no-op, not an event.
    @Transactional
    public Patient update(UUID patientId, UpdatePatientCommand cmd, UUID updatedByUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        Patient patient = patientRepository.findById(patientId).orElseThrow(PatientNotFoundException::new);
        if (patient.isArchived()) {
            throw new PatientArchivedException();
        }

        List<PatientFieldHistory> changes = new ArrayList<>();
        diff(changes, patientId, "firstName", patient.getFirstName(), cmd.firstName(), cmd.reason(), updatedByUserId);
        diff(changes, patientId, "lastName", patient.getLastName(), cmd.lastName(), cmd.reason(), updatedByUserId);
        diff(changes, patientId, "address", patient.getAddress(), cmd.address(), cmd.reason(), updatedByUserId);
        diff(changes, patientId, "contactNumber", patient.getContactNumber(), cmd.contactNumber(), cmd.reason(),
                updatedByUserId);
        diff(changes, patientId, "medicalAidProvider", patient.getMedicalAidProvider(), cmd.medicalAidProvider(),
                cmd.reason(), updatedByUserId);
        diff(changes, patientId, "medicalAidNumber", patient.getMedicalAidNumber(), cmd.medicalAidNumber(),
                cmd.reason(), updatedByUserId);
        diff(changes, patientId, "passportNumber", patient.getPassportNumber(), cmd.passportNumber(), cmd.reason(),
                updatedByUserId);
        diff(changes, patientId, "passportExpiry", asString(patient.getPassportExpiry()),
                asString(cmd.passportExpiry()), cmd.reason(), updatedByUserId);

        if (changes.isEmpty()) {
            return patient;
        }

        patient.setFirstName(cmd.firstName());
        patient.setLastName(cmd.lastName());
        patient.setAddress(cmd.address());
        patient.setContactNumber(cmd.contactNumber());
        patient.setMedicalAidProvider(cmd.medicalAidProvider());
        patient.setMedicalAidNumber(cmd.medicalAidNumber());
        patient.setPassportNumber(cmd.passportNumber());
        patient.setPassportExpiry(cmd.passportExpiry());
        patientRepository.save(patient);
        fieldHistoryRepository.saveAll(changes);

        // null/null for before/after, same as every other auditLogService.append()
        // call site in this codebase (AuthService.java's own why-note on
        // this) — audit_log.before_value/after_value are JSONB, so a plain
        // joined string there would fail with "invalid input syntax for
        // type json", not silently truncate. The real per-field detail
        // already lives in patient_field_history, a proper table rather
        // than a JSON blob; this row just marks that an update happened.
        auditLogService.append(updatedByUserId, null, "PATIENT_UPDATED", "Patient", patient.getId().toString(),
                null, null);

        return patient;
    }

    // PREG-US-017 AC2 / PREG-US-018 — the only way a patient record leaves
    // active use; there is still no delete method anywhere in this module.
    // One-way (Patient.archive()'s own why-note) — no unarchive endpoint
    // exists, so double-check with the caller before wiring a UI that
    // fires this without confirmation.
    @Transactional
    public Patient archive(UUID patientId, String reason, LocalDate deceasedDate, UUID archivedByUserId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.MANAGE);
        Patient patient = patientRepository.findById(patientId).orElseThrow(PatientNotFoundException::new);
        if (patient.isArchived()) {
            throw new PatientAlreadyArchivedException();
        }
        patient.archive(reason, deceasedDate, archivedByUserId, clock.instant());
        patientRepository.save(patient);

        // null/null for before/after — same JSONB-column reasoning as
        // update()'s own why-note above; the reason/date/actor already live
        // on the patient row itself (getArchivedReason() etc.), no separate
        // history table needed the way field-level edits get one.
        auditLogService.append(archivedByUserId, null, "PATIENT_ARCHIVED", "Patient", patient.getId().toString(),
                null, null);

        return patient;
    }

    public List<PatientFieldHistory> getFieldHistory(UUID patientId) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        if (!patientRepository.existsById(patientId)) {
            throw new PatientNotFoundException();
        }
        return fieldHistoryRepository.findByPatientIdOrderByChangedAtDesc(patientId);
    }

    // Null and "" are treated as the same "nothing here" value — an
    // optional field going from null to "" (or vice versa) because of how
    // an empty form field round-trips isn't a real change worth a history
    // row and a forced reason.
    private void diff(List<PatientFieldHistory> changes, UUID patientId, String field, String oldVal, String newVal,
                       String reason, UUID userId) {
        String normalizedOld = oldVal == null ? "" : oldVal;
        String normalizedNew = newVal == null ? "" : newVal;
        if (normalizedOld.equals(normalizedNew)) {
            return;
        }
        changes.add(new PatientFieldHistory(patientId, field, oldVal, newVal, reason, userId, clock.instant()));
    }

    private static String asString(LocalDate date) {
        return date == null ? null : date.toString();
    }

    // PREG-US-008: "matching results are returned within 3 seconds ...
    // offers registration path on no-match" — the second half is a
    // frontend concern (an empty result set is enough for the UI to show
    // that path), nothing this method needs to special-case.
    public List<Patient> search(String query) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        String trimmed = query == null ? "" : query.trim();
        if (trimmed.isEmpty()) {
            return List.of();
        }
        return patientRepository.search(trimmed);
    }

    // The default landing view for PatientSearchPage — the full roster,
    // paged, sorted, and optionally filtered, before anyone has typed a
    // search query. size is clamped the same way a page param would be
    // validated at any other paged endpoint; there's no @Max on the request
    // DTO here since this takes plain @RequestParams, not a validated body.
    // Every filter/sort param here comes in as a raw, untrusted string
    // straight off the query string — every one of them is parsed
    // defensively below and falls back to "no filter" / the default sort
    // rather than erroring, so a stale or hand-edited URL degrades instead
    // of 400ing. createdFrom/createdTo are plain "yyyy-MM-dd" calendar
    // dates (a date-picker's own value, not a timestamp) — interpreted as
    // UTC day boundaries rather than the server's local zone, so the
    // filter behaves the same regardless of what machine the API happens
    // to be deployed on.
    public Page<Patient> list(int page, int size, String sortBy, String sortDir, String gender, String medicalAid,
                               String mpiNumber, String citizenship, String createdFrom, String createdTo) {
        permissionService.requireAccess(ModuleCode.PREG, PermissionLevel.VIEW);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(safePage, safeSize, buildSort(sortBy, sortDir));
        return patientRepository.findFiltered(parseGender(gender), parseYesNo(medicalAid), parseMpi(mpiNumber),
                parseCitizenship(citizenship), parseDayStart(createdFrom), parseDayEnd(createdTo), pageable);
    }

    // "Youngest first" (age ascending) is the more recent date of birth —
    // the opposite of what a plain ascending sort on dateOfBirth would give,
    // so this is the one sort key where the human-facing direction and the
    // column's own natural ordering point opposite ways.
    private static Sort buildSort(String sortBy, String sortDir) {
        boolean descending = "desc".equalsIgnoreCase(sortDir);
        Sort.Direction direction = descending ? Sort.Direction.DESC : Sort.Direction.ASC;
        String key = sortBy == null ? "" : sortBy;
        return switch (key) {
            case "age" -> Sort.by(descending ? Sort.Direction.ASC : Sort.Direction.DESC, "dateOfBirth");
            case "registered" -> Sort.by(direction, "createdAt");
            case "mpi" -> Sort.by(direction, "mpiNumber");
            default -> Sort.by(direction, "lastName", "firstName");
        };
    }

    private static Gender parseGender(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Gender.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static Boolean parseYesNo(String raw) {
        if (raw == null) {
            return null;
        }
        return switch (raw.trim().toLowerCase()) {
            case "yes", "true" -> Boolean.TRUE;
            case "no", "false" -> Boolean.FALSE;
            default -> null;
        };
    }

    // Returns "" rather than null for "no filter" — deliberately, unlike
    // every other parseX() here — see findFiltered()'s own why-note on why
    // a bound NULL specifically breaks this one query branch.
    private static String parseMpi(String raw) {
        return raw == null ? "" : raw.trim();
    }

    private static CitizenshipStatus parseCitizenship(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return CitizenshipStatus.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    // findFiltered()'s createdAt range is always bounded — a null Instant
    // bound into a bare "? IS NULL" check (no other typed context in that
    // position) makes Postgres unable to determine that parameter's type,
    // a sibling of parseMpi()'s own bytea issue. These sentinels stand in
    // for "no bound" instead: 1970-01-01 predates any real patient's
    // createdAt, and 9999-12-31 is deliberately short of Instant.MAX (year
    // ~1e9) — timestamptz's own range ends at 294276 AD, and a value past
    // that overflows the JDBC driver's binary encoding of it.
    private static final Instant NO_LOWER_BOUND = Instant.EPOCH;
    private static final Instant NO_UPPER_BOUND = Instant.parse("9999-12-31T23:59:59.999999999Z");

    private static Instant parseDayStart(String raw) {
        LocalDate date = parseDate(raw);
        return date == null ? NO_LOWER_BOUND : date.atStartOfDay(ZoneOffset.UTC).toInstant();
    }

    private static Instant parseDayEnd(String raw) {
        LocalDate date = parseDate(raw);
        return date == null ? NO_UPPER_BOUND : date.atTime(LocalTime.MAX).atZone(ZoneOffset.UTC).toInstant();
    }

    private static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    public record RegisterPatientCommand(String firstName, String lastName, String idNumber, String address,
                                          String contactNumber, String medicalAidProvider, String medicalAidNumber,
                                          String passportNumber, LocalDate passportExpiry) {
    }

    // No idNumber/dateOfBirth/gender/citizenshipStatus/mpiNumber here at
    // all — Patient's own why-note on why none of them has a setter to
    // call. reason is required unconditionally (PatientFieldHistory's own
    // why-note on why this doesn't try to classify "clinically
    // significant" fields).
    public record UpdatePatientCommand(String firstName, String lastName, String address, String contactNumber,
                                        String medicalAidProvider, String medicalAidNumber, String passportNumber,
                                        LocalDate passportExpiry, String reason) {
    }
}
