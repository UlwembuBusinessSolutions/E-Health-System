package co.ehealth.platform.triage;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientArchivedException;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitNotFoundException;
import co.ehealth.platform.visit.VisitRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TriageService {

    // Who may capture/correct/override clinical observations — a
    // deliberately narrower gate than RECQ:MANAGE alone (PermissionService.
    // requireAnyRole()'s own why-note): RECQ:MANAGE also covers Queue
    // Marshall, Admin Staff, and Facility Manager, none of whom should be
    // able to submit a patient's vital signs just because they can call
    // the next token. Matches the roles V13__rbac_matrix_fix_visit_creation.sql
    // deliberately granted RECQ:MANAGE to for clinical front-line work.
    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");

    private static final String NOT_CLINICAL_ROLE_MESSAGE =
            "Only clinical staff (nurse, doctor, clinician, or occupational health practitioner) may do this.";

    private final TriageAssessmentRepository triageAssessmentRepository;
    private final VisitRepository visitRepository;
    private final PatientService patientService;
    private final UserRepository userRepository;
    private final AuditLogService auditLogService;
    private final PermissionService permissionService;
    private final Clock clock;

    public TriageService(TriageAssessmentRepository triageAssessmentRepository, VisitRepository visitRepository,
                          PatientService patientService, UserRepository userRepository,
                          AuditLogService auditLogService, PermissionService permissionService, Clock clock) {
        this.triageAssessmentRepository = triageAssessmentRepository;
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.userRepository = userRepository;
        this.auditLogService = auditLogService;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    // RECQ-US-008/009/010 — capture one triage/vitals assessment.
    // Idempotent: a request carrying a key already used for this visit
    // returns the existing row instead of inserting a duplicate (a
    // double-click or a client retry after a dropped response must never
    // create two assessments for one real observation).
    @Transactional
    public TriageAssessment capture(TriageCaptureCommand cmd, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, NOT_CLINICAL_ROLE_MESSAGE);

        if (!StringUtils.hasText(cmd.idempotencyKey())) {
            throw new InvalidTriageCaptureException("An idempotency key is required for vitals capture.");
        }
        if (cmd.observedAt() != null && cmd.observedAt().isAfter(clock.instant().plusSeconds(300))) {
            throw new InvalidTriageCaptureException("Observation time cannot be in the future.");
        }

        Optional<TriageAssessment> existing =
                triageAssessmentRepository.findByVisitIdAndIdempotencyKey(cmd.visitId(), cmd.idempotencyKey());
        if (existing.isPresent()) {
            return existing.get();
        }

        Visit visit = visitRepository.findById(cmd.visitId()).orElseThrow(VisitNotFoundException::new);
        Patient patient = patientService.get(visit.getPatientId());
        if (patient.isArchived()) {
            throw new PatientArchivedException();
        }

        if (cmd.emergencySign() && !StringUtils.hasText(cmd.emergencySignNote())) {
            throw new InvalidTriageCaptureException(
                    "Describe the emergency sign observed before assigning Red this way.");
        }
        // Emergency fast path saves the minimum available context and
        // does not wait for a complete set of vitals (SATS's own
        // "start emergency care; do not delay for data entry" workflow,
        // Docs/vitals-triage-plan.md §1.1) — the requirement below only
        // applies once that fast path isn't in play.
        if (!cmd.emergencySign()) {
            requireVitalsForScoring(cmd);
        }

        if (cmd.additionalObservations() != null) cmd.additionalObservations().validate();
        List<String> validationWarnings = validateMeasurements(cmd);
        if (!validationWarnings.isEmpty() && !cmd.confirmOutOfRange()) {
            throw new InvalidTriageCaptureException("Confirm these unusual measurements before saving: "
                    + String.join("; ", validationWarnings));
        }

        ScoringProfile profile = cmd.scoringProfileOverride() != null ? cmd.scoringProfileOverride()
                : deriveScoringProfile(patient.getDateOfBirth());
        boolean manuallyConfirmed = cmd.scoringProfileOverride() != null;

        Set<TriageDiscriminator> discriminators = cmd.discriminators() == null ? Set.of() : cmd.discriminators();
        TewsCalculator.Result result = new TewsCalculator().calculate(cmd.emergencySign(), profile,
                cmd.respiratoryRate(), cmd.heartRate(), cmd.systolicBp(), cmd.temperatureCelsius(), cmd.avpu(),
                cmd.mobility(), discriminators, cmd.additionalObservations());
        if (!cmd.emergencySign() && profile != ScoringProfile.ADULT
                && (cmd.clinicianConfirmedColour() == null || !StringUtils.hasText(cmd.colourConfirmationReason()))) {
            throw new InvalidTriageCaptureException(
                    "Paediatric TEWS tables are not approved yet; select and explain the clinician-confirmed colour.");
        }

        TriageAssessment superseded = null;
        if (cmd.supersedesAssessmentId() != null) {
            superseded = findAssessment(cmd.supersedesAssessmentId());
            if (!superseded.getVisitId().equals(cmd.visitId())) {
                throw new InvalidTriageCaptureException("That assessment doesn't belong to this visit.");
            }
            if (superseded.getStatus() != TriageAssessmentStatus.ACTIVE) {
                throw new InvalidTriageCaptureException("Only an active assessment can be superseded.");
            }
        }

        Instant now = clock.instant();
        TriageAssessment assessment = new TriageAssessment(cmd.visitId(), cmd.emergencySign(),
                cmd.emergencySignNote(), profile, manuallyConfirmed, cmd.respiratoryRate(), cmd.heartRate(),
                cmd.systolicBp(), cmd.diastolicBp(), cmd.temperatureCelsius(), cmd.spo2Percent(),
                cmd.oxygenSupport() == null ? OxygenSupport.ROOM_AIR : cmd.oxygenSupport(), cmd.oxygenDevice(),
                cmd.oxygenFlowLpm(), cmd.avpu(), cmd.mobility(), cmd.painScore(), cmd.painScale(),
                cmd.presentingComplaint(), !validationWarnings.isEmpty(), String.join("; ", validationWarnings),
                discriminators, result.tewsScore(), TewsCalculator.SCORING_VERSION,
                result.calculatedColour(), result.calculatedColour(), staffUserId, cmd.observedAt() != null
                        ? cmd.observedAt() : now, now, cmd.idempotencyKey());

        if (superseded != null) {
            assessment.linkSupersedes(superseded.getId());
        }
        if (!cmd.emergencySign() && profile != ScoringProfile.ADULT) {
            if (cmd.clinicianConfirmedColour().compareTo(result.calculatedColour()) < 0) {
                throw new InvalidTriageCaptureException("The selected colour is below the urgency identified by this assessment.");
            }
            assessment.override(cmd.clinicianConfirmedColour(), cmd.colourConfirmationReason(), staffUserId);
        }
        assessment.setAdditionalObservations(cmd.additionalObservations());
        triageAssessmentRepository.save(assessment);

        if (superseded != null) {
            superseded.markSuperseded();
            triageAssessmentRepository.save(superseded);
        }

        auditLogService.append(staffUserId, visit.getFacilityId(), "TRIAGE_ASSESSMENT_CAPTURED",
                "TriageAssessment", assessment.getId().toString(), null, null);
        return assessment;
    }

    // A senior clinician disagreeing with the calculated colour — kept as
    // its own action rather than letting a second capture() call silently
    // change a result, so "the algorithm said X, a person changed it to Y,
    // here's why" is always explicit on the record. Scoped to the same
    // clinical roles as capture(); this codebase has no concept of a
    // "senior" clinician role yet to narrow it further than that (a real
    // gap, not an oversight — see Docs/vitals-triage-plan.md §6).
    @Transactional
    public TriageAssessment override(UUID assessmentId, TriageColour finalColour, String reason, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, NOT_CLINICAL_ROLE_MESSAGE);
        if (!StringUtils.hasText(reason)) {
            throw new InvalidTriageCaptureException("A reason is required to override the calculated colour.");
        }
        TriageAssessment assessment = findAssessment(assessmentId);
        if (assessment.getStatus() != TriageAssessmentStatus.ACTIVE) {
            throw new InvalidTriageCaptureException("Only an active assessment can be overridden.");
        }
        assessment.override(finalColour, reason, staffUserId);
        triageAssessmentRepository.save(assessment);
        Visit visit = visitRepository.findById(assessment.getVisitId()).orElseThrow(VisitNotFoundException::new);
        auditLogService.append(staffUserId, visit.getFacilityId(), "TRIAGE_COLOUR_OVERRIDDEN", "TriageAssessment",
                assessment.getId().toString(), null, null);
        return assessment;
    }

    // A pure mistake — wrong patient, fat-fingered entry — with nothing to
    // replace it, unlike capture(..., supersedesAssessmentId) which
    // corrects by replacing. Still never deletes the row.
    @Transactional
    public TriageAssessment markEnteredInError(UUID assessmentId, String reason, UUID staffUserId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, NOT_CLINICAL_ROLE_MESSAGE);
        if (!StringUtils.hasText(reason)) {
            throw new InvalidTriageCaptureException("A reason is required.");
        }
        TriageAssessment assessment = findAssessment(assessmentId);
        if (assessment.getStatus() != TriageAssessmentStatus.ACTIVE) {
            throw new InvalidTriageCaptureException("Only an active assessment can be marked entered-in-error.");
        }
        assessment.markEnteredInError(reason);
        triageAssessmentRepository.save(assessment);
        Visit visit = visitRepository.findById(assessment.getVisitId()).orElseThrow(VisitNotFoundException::new);
        auditLogService.append(staffUserId, visit.getFacilityId(), "TRIAGE_ASSESSMENT_ENTERED_IN_ERROR",
                "TriageAssessment", assessment.getId().toString(), null, null);
        return assessment;
    }

    // Full history, oldest first — read access only needs RECQ:VIEW
    // (Pharmacist, Social Worker, Compliance Officer, and other read-only
    // roles can see triage results without being able to capture them).
    public List<TriageAssessment> getHistory(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        return triageAssessmentRepository.findByVisitIdOrderByObservedAtAsc(visitId);
    }

    public Optional<TriageAssessment> getLatestActive(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        List<TriageAssessment> active = triageAssessmentRepository.findActiveOrderByObservedAtDesc(visitId);
        return active.isEmpty() ? Optional.empty() : Optional.of(active.get(0));
    }

    // The patient-level Vitals tab (PatientDetailPage) — every capture
    // across every visit this patient has ever had, not just one visit's
    // own timeline, so a clinician can see the trend across a
    // long-standing patient's whole relationship with this facility.
    // from/to filter by observed date (inclusive); either or both may be
    // null for "no bound on that side." Resolves capturedByUserId to a
    // display name here, in the service layer, same as QueueService.toView()
    // already resolves a token's patientId to a name — a raw UUID isn't
    // something a "who captured this" column can show. Paginated the same
    // shape QueueService.listQueueView() already established (page/pageSize
    // clamped, totalElements/totalPages computed, sublist taken after
    // filtering) — an in-memory page over an already-fetched, already-
    // filtered list, the same accepted trade-off that method documents:
    // one patient's vitals history is nowhere near queue-scale data.
    // ascending flips the default newest-first order to oldest-first,
    // reusing the single DESC-ordered fetch rather than adding a second,
    // near-duplicate repository query for the reverse order.
    public PatientVitalsHistoryPage getPatientVitalsHistory(UUID patientId, LocalDate from, LocalDate to,
                                                             boolean ascending, int page, int pageSize) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        List<UUID> visitIds = visitRepository.findByPatientId(patientId).stream().map(Visit::getId).toList();
        List<TriageAssessment> assessments = visitIds.isEmpty() ? List.of()
                : triageAssessmentRepository.findByVisitIdInOrderByObservedAtDesc(visitIds);
        List<TriageAssessment> filtered = (from == null && to == null) ? assessments
                : assessments.stream().filter(a -> withinDateRange(a.getObservedAt(), from, to)).toList();
        List<TriageAssessment> ordered = ascending
                ? filtered.stream().sorted(Comparator.comparing(TriageAssessment::getObservedAt)).toList()
                : filtered;

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(pageSize, 1), 100);
        int totalElements = ordered.size();
        int totalPages = totalElements == 0 ? 0 : (int) Math.ceil((double) totalElements / safeSize);
        int fromIndex = Math.min(safePage * safeSize, totalElements);
        int toIndex = Math.min(fromIndex + safeSize, totalElements);
        List<TriageAssessment> pageSlice = ordered.subList(fromIndex, toIndex);

        Map<UUID, String> capturedByNames = resolveCapturedByNames(pageSlice);
        List<PatientVitalsView> items = pageSlice.stream()
                .map(a -> new PatientVitalsView(a, capturedByNames.get(a.getCapturedByUserId())))
                .toList();
        return new PatientVitalsHistoryPage(items, safePage, safeSize, totalElements, totalPages);
    }

    // VitalsPrintPage's fetch-by-id — the print button opens a fresh tab
    // (window.open(), not an in-memory prop), and unlike the on-screen
    // modal that fresh tab has no surrounding page that already shows whose
    // record this is, so the patient's own name/MPI has to travel with the
    // assessment itself here — a printed vitals reading with no patient
    // identifier on it is useless (worse: mixable with someone else's) the
    // moment it leaves the screen. A separate return shape from
    // getPatientVitalsHistory()'s PatientVitalsView rather than adding these
    // fields there too: that list is already scoped to one patient the
    // caller already knows, so resolving it again per row would just be a
    // repeated lookup of the same patient for no reason.
    public VitalsAssessmentDetail getAssessment(UUID assessmentId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        TriageAssessment assessment = findAssessment(assessmentId);
        Visit visit = visitRepository.findById(assessment.getVisitId()).orElseThrow(VisitNotFoundException::new);
        Patient patient = patientService.get(visit.getPatientId());
        String capturedByName = resolveCapturedByNames(List.of(assessment)).get(assessment.getCapturedByUserId());
        return new VitalsAssessmentDetail(assessment, capturedByName,
                patient.getFirstName() + " " + patient.getLastName(), patient.getMpiNumber());
    }

    // observedAt is a point in time; from/to are calendar dates a clinician
    // picked in a date-range filter — UTC is the same pragmatic choice
    // deriveScoringProfile() already makes below rather than resolving a
    // specific facility's timezone, since a patient's vitals here can span
    // several facilities with no single timezone to prefer.
    private boolean withinDateRange(Instant observedAt, LocalDate from, LocalDate to) {
        LocalDate date = observedAt.atZone(ZoneOffset.UTC).toLocalDate();
        if (from != null && date.isBefore(from)) {
            return false;
        }
        return to == null || !date.isAfter(to);
    }

    private Map<UUID, String> resolveCapturedByNames(List<TriageAssessment> assessments) {
        Set<UUID> userIds = assessments.stream().map(TriageAssessment::getCapturedByUserId)
                .collect(Collectors.toSet());
        return userRepository.findAllById(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u.getFirstName() + " " + u.getLastName()));
    }

    public record PatientVitalsView(TriageAssessment assessment, String capturedByName) {
    }

    public record PatientVitalsHistoryPage(List<PatientVitalsView> items, int page, int pageSize,
                                            int totalElements, int totalPages) {
    }

    public record VitalsAssessmentDetail(TriageAssessment assessment, String capturedByName, String patientName,
                                          String patientMpi) {
    }

    private void requireVitalsForScoring(TriageCaptureCommand cmd) {
        if (cmd.additionalObservations() == null || cmd.additionalObservations().traumaPresent == null) {
            throw new InvalidTriageCaptureException("Record whether trauma is present before calculating TEWS.");
        }
        if (cmd.respiratoryRate() == null) {
            throw new InvalidTriageCaptureException("Respiratory rate is required.");
        }
        if (cmd.heartRate() == null) {
            throw new InvalidTriageCaptureException("Heart rate is required.");
        }
        if (cmd.systolicBp() == null) {
            throw new InvalidTriageCaptureException("Systolic blood pressure is required.");
        }
        if (cmd.temperatureCelsius() == null) {
            throw new InvalidTriageCaptureException("Temperature is required.");
        }
        if (cmd.avpu() == null) {
            throw new InvalidTriageCaptureException("AVPU is required.");
        }
        if (cmd.mobility() == null) {
            throw new InvalidTriageCaptureException("Mobility is required.");
        }
    }

    private List<String> validateMeasurements(TriageCaptureCommand cmd) {
        List<String> warnings = new ArrayList<>();
        requirePositive(cmd.respiratoryRate(), "Respiratory rate");
        requirePositive(cmd.heartRate(), "Heart rate");
        requirePositive(cmd.systolicBp(), "Systolic blood pressure");
        requirePositive(cmd.diastolicBp(), "Diastolic blood pressure");
        if (cmd.temperatureCelsius() != null && cmd.temperatureCelsius() <= 0) {
            throw new InvalidTriageCaptureException("Temperature must be greater than zero.");
        }
        if (cmd.spo2Percent() != null && (cmd.spo2Percent() < 0 || cmd.spo2Percent() > 100)) {
            throw new InvalidTriageCaptureException("SpO2 must be between 0 and 100%.");
        }
        if (cmd.oxygenFlowLpm() != null && cmd.oxygenFlowLpm() < 0) {
            throw new InvalidTriageCaptureException("Oxygen flow cannot be negative.");
        }
        if (cmd.painScore() != null && (cmd.painScore() < 0 || cmd.painScore() > 10)) {
            throw new InvalidTriageCaptureException("Pain score must be between 0 and 10.");
        }
        if (cmd.oxygenSupport() == OxygenSupport.SUPPLEMENTAL
                && (!StringUtils.hasText(cmd.oxygenDevice()) || cmd.oxygenFlowLpm() == null)) {
            throw new InvalidTriageCaptureException(
                    "Oxygen device and flow rate are required when supplemental oxygen is selected.");
        }
        warnOutside(warnings, cmd.respiratoryRate(), 1, 100, "Respiratory rate");
        warnOutside(warnings, cmd.heartRate(), 20, 300, "Heart rate");
        warnOutside(warnings, cmd.systolicBp(), 40, 300, "Systolic blood pressure");
        warnOutside(warnings, cmd.diastolicBp(), 20, 200, "Diastolic blood pressure");
        if (cmd.temperatureCelsius() != null
                && (cmd.temperatureCelsius() < 25 || cmd.temperatureCelsius() > 45)) {
            warnings.add("Temperature " + cmd.temperatureCelsius() + " °C");
        }
        if (cmd.spo2Percent() != null && cmd.spo2Percent() < 50) {
            warnings.add("SpO2 " + cmd.spo2Percent() + "%");
        }
        if (cmd.additionalObservations() != null) {
            var a = cmd.additionalObservations();
            warnAdditional(warnings, a.weightKg, 0.2, 500, "Weight (kg)");
            warnAdditional(warnings, a.heightCm, 10, 250, "Height (cm)");
            warnAdditional(warnings, a.glucoseMmolL, 0.1, 100, "Glucose (mmol/L)");
            warnAdditional(warnings, a.haemoglobinGdl, 0.1, 30, "Haemoglobin (g/dL)");
        }
        return warnings;
    }

    // Data-entry plausibility checks, not normal clinical ranges. Confirmed extremes remain recordable.
    private void warnAdditional(List<String> warnings, Double value, double minimum, double maximum, String label) {
        if (value != null && (value < minimum || value > maximum)) warnings.add(label + " " + value);
    }

    private void requirePositive(Integer value, String label) {
        if (value != null && value <= 0) {
            throw new InvalidTriageCaptureException(label + " must be greater than zero.");
        }
    }

    private void warnOutside(List<String> warnings, Integer value, int minimum, int maximum, String label) {
        if (value != null && (value < minimum || value > maximum)) {
            warnings.add(label + " " + value);
        }
    }

    // Age-from-date-of-birth is a pragmatic stand-in for SATS's real,
    // height-based paediatric bands (ScoringProfile's own why-note) — a
    // digital form has no way to read a height-based colour tape, and age
    // is the closest single field this system already has. The clinician
    // can always override via scoringProfileOverride when age alone isn't
    // a confident signal.
    private ScoringProfile deriveScoringProfile(LocalDate dateOfBirth) {
        int ageYears = Period.between(dateOfBirth, clock.instant().atZone(ZoneOffset.UTC).toLocalDate()).getYears();
        if (ageYears >= 13) {
            return ScoringProfile.ADULT;
        }
        if (ageYears >= 3) {
            return ScoringProfile.PAEDIATRIC_OLDER_CHILD;
        }
        return ScoringProfile.PAEDIATRIC_YOUNGER_CHILD;
    }

    private TriageAssessment findAssessment(UUID id) {
        return triageAssessmentRepository.findById(id).orElseThrow(TriageAssessmentNotFoundException::new);
    }

    public record TriageCaptureCommand(UUID visitId, boolean emergencySign, String emergencySignNote,
                                        ScoringProfile scoringProfileOverride, Integer respiratoryRate,
                                        Integer heartRate, Integer systolicBp, Integer diastolicBp,
                                        Double temperatureCelsius, Integer spo2Percent, OxygenSupport oxygenSupport,
                                        String oxygenDevice, Double oxygenFlowLpm, Avpu avpu, Mobility mobility,
                                        Integer painScore, String painScale, String presentingComplaint,
                                        Set<TriageDiscriminator> discriminators, UUID supersedesAssessmentId,
                                        Instant observedAt, String idempotencyKey, boolean confirmOutOfRange,
                                        TriageColour clinicianConfirmedColour, String colourConfirmationReason, AdditionalObservations additionalObservations) {
    }
}
