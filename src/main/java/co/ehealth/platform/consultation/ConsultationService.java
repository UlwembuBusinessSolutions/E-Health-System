package co.ehealth.platform.consultation;

import co.ehealth.platform.core.audit.AuditDetails;
import co.ehealth.platform.diagnosis.Diagnosis;
import co.ehealth.platform.diagnosis.DiagnosisCatalogueService;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientArchivedException;
import co.ehealth.platform.patient.PatientService;
import co.ehealth.platform.pharmacy.PrescriptionService;
import co.ehealth.platform.visit.QueueService;
import co.ehealth.platform.triage.TriageAssessmentRepository;
import co.ehealth.platform.visit.Visit;
import co.ehealth.platform.visit.VisitNotFoundException;
import co.ehealth.platform.visit.VisitRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class ConsultationService {

    // Gated behind RECQ (Reception, Triage & Queue Management) rather than
    // a dedicated module — the same module TriageAssessment already
    // extends instead of getting its own, and RECQ:MANAGE is already
    // seeded to exactly these four roles (V13__rbac_matrix_fix_visit_creation.sql).
    private static final Set<String> CLINICAL_ROLES =
            Set.of("Professional Nurse", "Doctor", "Clinician", "Occupational Health Practitioner");

    // Deliberately narrower than CLINICAL_ROLES: the design brainstorm
    // (Docs/vitals-to-consultation-pharmacy-closure-brainstorm.md §13.7)
    // explicitly warns against letting any clinical role sign a
    // consultation without a real service-scope matrix, which this slice
    // doesn't build. Doctor and Clinician are the initial signing-eligible
    // roles; nursing can draft but not sign in this version.
    private static final int MIN_BYPASS_NOTE_LENGTH = 3;
    private static final Set<String> SIGNING_ROLES = Set.of("Doctor", "Clinician");

    private static final String NOT_CLINICAL_ROLE_MESSAGE =
            "Only clinical staff (nurse, doctor, clinician, or occupational health practitioner) may do this.";
    private static final String NOT_SIGNING_ROLE_MESSAGE =
            "Only a doctor or clinician may sign a consultation in this version.";

    private final ConsultationRepository consultationRepository;
    private final ConsultationDiagnosisRepository consultationDiagnosisRepository;
    private final VisitRepository visitRepository;
    private final PatientService patientService;
    private final AuditLogService auditLogService;
    private final PermissionService permissionService;
    private final QueueService queueService;
    private final FacilityService facilityService;
    private final PrescriptionService prescriptionService;
    private final TriageAssessmentRepository triageRepository;
    private final DiagnosisCatalogueService diagnosisCatalogue;
    private final Clock clock;
    private final ObjectMapper objectMapper;

    public ConsultationService(ConsultationRepository consultationRepository,
                                ConsultationDiagnosisRepository consultationDiagnosisRepository,
                                VisitRepository visitRepository, PatientService patientService,
                                AuditLogService auditLogService, PermissionService permissionService,
                                QueueService queueService, FacilityService facilityService,
                                PrescriptionService prescriptionService, TriageAssessmentRepository triageRepository,
                                DiagnosisCatalogueService diagnosisCatalogue, Clock clock, ObjectMapper objectMapper) {
        this.triageRepository = triageRepository;
        this.diagnosisCatalogue = diagnosisCatalogue;
        this.consultationRepository = consultationRepository;
        this.consultationDiagnosisRepository = consultationDiagnosisRepository;
        this.visitRepository = visitRepository;
        this.patientService = patientService;
        this.auditLogService = auditLogService;
        this.permissionService = permissionService;
        this.queueService = queueService;
        this.facilityService = facilityService;
        this.prescriptionService = prescriptionService;
        this.clock = clock;
        this.objectMapper = objectMapper;
    }

    // AuditLog.beforeValue/afterValue are a raw jsonb column — the caller
    // supplies already-serialized text, same discipline as
    // identity.AuthService.serializeLoginState(). Swallows serialization
    // failure the same way: a malformed audit detail must never fail the
    // diagnosis add/remove itself.
    private String serializeText(String text) {
        if (text == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(text);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    // Get-or-create: there is no claim/assignment concept in this slice
    // (that's VisitServiceTask, explicitly out of scope), so "start a
    // consultation" simply means "there is now a draft row for this
    // visit" — a second call against the same visit returns the existing
    // draft rather than creating a sibling.
    @Transactional
    public Consultation createDraft(UUID visitId, UUID staffUserId) {
        return createDraft(visitId, staffUserId, null, null);
    }

    // A visit normally has vitals before the doctor sees the patient. Starting without
    // them is allowed (an emergency, a follow-up with nothing changed) but only with a
    // reason, which is saved on the consultation and in the audit trail.
    @Transactional
    public Consultation createDraft(UUID visitId, UUID staffUserId, VitalsBypassReason bypassReason,
                                    String bypassNote) {
        return createDraft(visitId, staffUserId, bypassReason, bypassNote, null);
    }

    // continueFromConsultationId carries on from an earlier signed consultation of the same episode (see
    // findContinuable): the draft starts with a copy of its notes and diagnoses, and the vitals taken on
    // the earlier visit count, so no reason for skipping them is needed. Null starts a fresh consultation.
    @Transactional
    public Consultation createDraft(UUID visitId, UUID staffUserId, VitalsBypassReason bypassReason,
                                    String bypassNote, UUID continueFromConsultationId) {
        requireDraftAccess();
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        Patient patient = patientService.get(visit.getPatientId());
        if (patient.isArchived()) {
            throw new PatientArchivedException();
        }

        Optional<Consultation> existingDraft = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT);
        if (existingDraft.isPresent()) {
            return existingDraft.get();
        }

        EarlierConsultation earlier = null;
        if (continueFromConsultationId != null) {
            earlier = findContinuable(visitId)
                    .filter(candidate -> candidate.consultation().getId().equals(continueFromConsultationId))
                    .orElseThrow(() -> new InvalidConsultationException(
                            "That consultation cannot be continued on this visit."));
        }
        boolean hasVitals = !triageRepository.findActiveOrderByObservedAtDesc(visitId).isEmpty()
                || (earlier != null && earlier.vitalsVisitId() != null);
        String note = bypassNote == null ? null : bypassNote.trim();
        if (!hasVitals) {
            if (bypassReason == null) {
                throw new InvalidConsultationException(
                        "No vitals have been taken for this visit. Take vitals first, or say why they are being skipped.");
            }
            if (bypassReason == VitalsBypassReason.OTHER && (note == null || note.length() < MIN_BYPASS_NOTE_LENGTH)) {
                throw new InvalidConsultationException("Explain why vitals are being skipped (at least "
                        + MIN_BYPASS_NOTE_LENGTH + " characters).");
            }
        }

        Consultation consultation = new Consultation(visitId, staffUserId, clock.instant());
        if (!hasVitals) {
            consultation.recordVitalsBypass(bypassReason, note == null || note.isEmpty() ? null : note);
        }
        if (earlier != null) {
            consultation.continueFrom(earlier.consultation(), clock.instant());
        }
        consultationRepository.save(consultation);
        if (earlier != null) {
            copyDiagnoses(earlier.consultation().getId(), consultation.getId());
        }
        auditLogService.append(staffUserId, visit.getFacilityId(), "CONSULTATION_DRAFT_CREATED", "Consultation",
                consultation.getId().toString(), null, createdDetails(hasVitals, bypassReason, note, earlier));
        return consultation;
    }

    private static String createdDetails(boolean hasVitals, VitalsBypassReason bypassReason, String note,
                                         EarlierConsultation earlier) {
        if (earlier != null) {
            return AuditDetails.of("continuedFromConsultationId", earlier.consultation().getId().toString());
        }
        return hasVitals ? null
                : AuditDetails.of("vitalsBypassReason", bypassReason.name(), "vitalsBypassNote", note);
    }

    private void copyDiagnoses(UUID fromConsultationId, UUID toConsultationId) {
        for (ConsultationDiagnosis original : consultationDiagnosisRepository
                .findByConsultationIdOrderBySortOrderAsc(fromConsultationId)) {
            ConsultationDiagnosis copy = new ConsultationDiagnosis(toConsultationId, original.getDiagnosisText(),
                    original.isPrimary(), original.getCertainty(), original.getSortOrder());
            if (original.getDiagnosisId() != null) {
                diagnosisCatalogue.find(original.getDiagnosisId()).ifPresent(copy::applyCatalogueEntry);
            }
            consultationDiagnosisRepository.save(copy);
        }
    }

    /**
     * What the doctor can carry on from. {@code vitalsVisitId} is the nearest visit in the chain, this one
     * first, that has vitals on record; null when none does.
     */
    public record EarlierConsultation(Consultation consultation, UUID visitId, String facilityName,
                                      UUID vitalsVisitId) {
    }

    private static final int MAX_VISIT_CHAIN = 10;

    /**
     * The patient's earlier signed consultation for this episode of care. A visit made by transferring a
     * patient points back at the visit it replaced, so following those links finds the consultation
     * from before the patient was sent to the pharmacy or another facility. Empty when this visit
     * already has a consultation, or nothing earlier was signed.
     */
    public Optional<EarlierConsultation> findContinuable(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        if (getCurrent(visitId).isPresent()) {
            return Optional.empty();
        }
        Visit visit = visitRepository.findById(visitId).orElseThrow(VisitNotFoundException::new);
        UUID previous = visit.getTransferredFromVisitId();
        for (int step = 0; step < MAX_VISIT_CHAIN && previous != null; step++) {
            Optional<Visit> earlierVisit = visitRepository.findById(previous);
            if (earlierVisit.isEmpty()) {
                return Optional.empty();
            }
            Optional<Consultation> signed = consultationRepository
                    .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(previous, ConsultationStatus.SIGNED);
            if (signed.isPresent()) {
                return Optional.of(describe(signed.get(), earlierVisit.get(), visitId));
            }
            previous = earlierVisit.get().getTransferredFromVisitId();
        }
        return Optional.empty();
    }

    /** Where this consultation carried on from, if it did. */
    public Optional<EarlierConsultation> findContinuedFrom(Consultation consultation) {
        UUID earlierId = consultation.getContinuedFromConsultationId();
        if (earlierId == null) {
            return Optional.empty();
        }
        return consultationRepository.findById(earlierId).flatMap(earlier -> visitRepository
                .findById(earlier.getVisitId()).map(visit -> describe(earlier, visit, consultation.getVisitId())));
    }

    private EarlierConsultation describe(Consultation earlier, Visit earlierVisit, UUID currentVisitId) {
        return new EarlierConsultation(earlier, earlierVisit.getId(),
                facilityService.get(earlierVisit.getFacilityId()).getName(), nearestVisitWithVitals(currentVisitId));
    }

    private UUID nearestVisitWithVitals(UUID visitId) {
        UUID candidate = visitId;
        for (int step = 0; step <= MAX_VISIT_CHAIN && candidate != null; step++) {
            if (!triageRepository.findActiveOrderByObservedAtDesc(candidate).isEmpty()) {
                return candidate;
            }
            candidate = visitRepository.findById(candidate).map(Visit::getTransferredFromVisitId).orElse(null);
        }
        return null;
    }

    @Transactional
    public Consultation updateDraft(UUID id, UpdateConsultationCommand cmd, UUID staffUserId) {
        requireDraftAccess();
        Consultation consultation = findConsultation(id);
        requireDraft(consultation);
        consultation.updateFields(cmd.relevantHistory(), cmd.currentMedications(), cmd.allergyStatus(),
                cmd.allergyDetail(), cmd.examinationNotes(), cmd.investigationsNotes(), cmd.treatmentPlan(),
                clock.instant());
        // null means the caller did not send a prescription, so what is saved stays as it is.
        if (cmd.prescriptionDraft() != null) {
            consultation.savePrescriptionDraft(cmd.prescriptionDraft().isBlank() ? null : cmd.prescriptionDraft());
        }
        consultationRepository.save(consultation);
        return consultation;
    }

    // Marking a new diagnosis primary auto-clears any existing primary on
    // this same consultation first, so "mark this one primary" always
    // behaves like a radio button rather than a validation error — the
    // database's own partial unique index (V29) is the backstop, not the
    // normal path here.
    @Transactional
    public ConsultationDiagnosis addDiagnosis(UUID consultationId, String diagnosisText, boolean isPrimary,
                                               DiagnosisCertainty certainty, UUID staffUserId) {
        return addDiagnosis(consultationId, null, diagnosisText, isPrimary, certainty, staffUserId);
    }

    // The diagnosis is either picked from the catalogue (diagnosisId) or typed by name. A name that is not
    // in the catalogue yet is added to it, so every diagnosis recorded can be counted later.
    @Transactional
    public ConsultationDiagnosis addDiagnosis(UUID consultationId, UUID diagnosisId, String diagnosisText,
                                               boolean isPrimary, DiagnosisCertainty certainty, UUID staffUserId) {
        requireDraftAccess();
        Consultation consultation = findConsultation(consultationId);
        requireDraft(consultation);
        Diagnosis entry = catalogueEntryFor(diagnosisId, diagnosisText, staffUserId);
        if (isPrimary) {
            clearExistingPrimary(consultationId);
        }
        int sortOrder = consultationDiagnosisRepository.countByConsultationId(consultationId);
        ConsultationDiagnosis diagnosis = new ConsultationDiagnosis(consultationId, entry.getName(), isPrimary,
                certainty == null ? DiagnosisCertainty.PROVISIONAL : certainty, sortOrder);
        diagnosis.applyCatalogueEntry(entry);
        consultationDiagnosisRepository.save(diagnosis);
        consultation.touchUpdatedAt(clock.instant());
        consultationRepository.save(consultation);

        Visit visit = visitRepository.findById(consultation.getVisitId()).orElseThrow(VisitNotFoundException::new);
        auditLogService.append(staffUserId, visit.getFacilityId(), "CONSULTATION_DIAGNOSIS_ADDED",
                "ConsultationDiagnosis", diagnosis.getId().toString(), null, serializeText(entry.getName()));
        return diagnosis;
    }

    private Diagnosis catalogueEntryFor(UUID diagnosisId, String diagnosisText, UUID staffUserId) {
        if (diagnosisId != null) {
            return diagnosisCatalogue.find(diagnosisId)
                    .orElseThrow(() -> new InvalidConsultationException("Unknown diagnosis."));
        }
        if (!StringUtils.hasText(diagnosisText)) {
            throw new InvalidConsultationException("Diagnosis text is required.");
        }
        if (diagnosisText.trim().length() > Diagnosis.MAX_NAME_LENGTH) {
            throw new InvalidConsultationException("A diagnosis can be at most " + Diagnosis.MAX_NAME_LENGTH
                    + " characters.");
        }
        return diagnosisCatalogue.findOrAdd(diagnosisText, staffUserId);
    }

    @Transactional
    public void removeDiagnosis(UUID consultationId, UUID diagnosisId, UUID staffUserId) {
        requireDraftAccess();
        Consultation consultation = findConsultation(consultationId);
        requireDraft(consultation);
        ConsultationDiagnosis diagnosis = consultationDiagnosisRepository.findById(diagnosisId)
                .orElseThrow(() -> new InvalidConsultationException("Unknown diagnosis."));
        if (!diagnosis.getConsultationId().equals(consultationId)) {
            throw new InvalidConsultationException("That diagnosis doesn't belong to this consultation.");
        }
        // Captured before delete() — after this line the diagnosis text
        // exists nowhere else (unlike sign()/amend(), which snapshot a
        // consultation's full field set at the moment it becomes
        // immutable, a draft's diagnosis rows are just gone once removed).
        String removedText = diagnosis.getDiagnosisText();
        consultationDiagnosisRepository.delete(diagnosis);
        consultation.touchUpdatedAt(clock.instant());
        consultationRepository.save(consultation);

        Visit visit = visitRepository.findById(consultation.getVisitId()).orElseThrow(VisitNotFoundException::new);
        auditLogService.append(staffUserId, visit.getFacilityId(), "CONSULTATION_DIAGNOSIS_REMOVED",
                "ConsultationDiagnosis", diagnosisId.toString(), serializeText(removedText), null);
    }

    // Does NOT require at least one diagnosis — the design brainstorm
    // explicitly permits a symptom-based assessment when a definitive
    // diagnosis isn't available yet (§5).
    @Transactional
    public Consultation sign(UUID id, ConsultationOutcome outcome, String outcomeNotes,
                              List<PrescriptionService.PrescriptionItemInput> pharmacyItems,
                              List<PrescriptionService.PrescriptionPurchaseItemInput> purchaseItems,
                              UUID destinationFacilityId, UUID staffUserId) {
        requireSignAccess();
        if (outcome == null) {
            throw new InvalidConsultationException("Choose what happens next before signing.");
        }
        requirePharmacyItemsIfNeeded(outcome, pharmacyItems, purchaseItems);
        requireDestinationFacilityIfNeeded(outcome, destinationFacilityId);
        Consultation consultation = findConsultation(id);
        requireDraft(consultation);
        consultation.sign(outcome, outcomeNotes, staffUserId, clock.instant());
        consultationRepository.save(consultation);
        handleSendToPharmacy(consultation, pharmacyItems, purchaseItems, staffUserId);
        handleReferOrTransfer(consultation, destinationFacilityId, staffUserId);

        Visit visit = visitRepository.findById(consultation.getVisitId()).orElseThrow(VisitNotFoundException::new);
        auditLogService.append(staffUserId, visit.getFacilityId(), "CONSULTATION_SIGNED", "Consultation",
                consultation.getId().toString(), null, null);
        return consultation;
    }

    // A correction to a SIGNED record never edits it in place — this
    // creates a brand-new consultation (full field snapshot from cmd, not
    // a diff), signs it immediately, links it back to the original, and
    // marks the original SUPERSEDED. Same authority bar as sign(): amending
    // a signed record needs the same eligibility as signing one.
    @Transactional
    public Consultation amend(UUID originalId, AmendConsultationCommand cmd, UUID staffUserId) {
        requireSignAccess();
        if (!StringUtils.hasText(cmd.amendmentReason())) {
            throw new InvalidConsultationException("A reason is required to amend a signed consultation.");
        }
        if (cmd.outcome() == null) {
            throw new InvalidConsultationException("Choose what happens next before signing.");
        }
        requirePharmacyItemsIfNeeded(cmd.outcome(), cmd.pharmacyItems(), cmd.purchaseItems());
        requireDestinationFacilityIfNeeded(cmd.outcome(), cmd.destinationFacilityId());
        Consultation original = findConsultation(originalId);
        if (original.getStatus() != ConsultationStatus.SIGNED) {
            throw new InvalidConsultationStateException("Only a signed consultation can be amended.");
        }

        Instant now = clock.instant();
        Consultation amendment = new Consultation(original.getVisitId(), staffUserId, now);
        amendment.updateFields(cmd.relevantHistory(), cmd.currentMedications(), cmd.allergyStatus(),
                cmd.allergyDetail(), cmd.examinationNotes(), cmd.investigationsNotes(), cmd.treatmentPlan(), now);
        consultationRepository.save(amendment);

        int sortOrder = 0;
        for (DiagnosisInput input : cmd.diagnoses()) {
            Diagnosis entry = catalogueEntryFor(input.diagnosisId(), input.diagnosisText(), staffUserId);
            ConsultationDiagnosis copy = new ConsultationDiagnosis(amendment.getId(), entry.getName(),
                    input.isPrimary(), input.certainty() == null ? DiagnosisCertainty.PROVISIONAL : input.certainty(),
                    sortOrder++);
            copy.applyCatalogueEntry(entry);
            consultationDiagnosisRepository.save(copy);
        }

        amendment.sign(cmd.outcome(), cmd.outcomeNotes(), staffUserId, now);
        amendment.linkSupersedes(original.getId(), cmd.amendmentReason());
        consultationRepository.save(amendment);
        handleSendToPharmacy(amendment, cmd.pharmacyItems(), cmd.purchaseItems(), staffUserId);
        handleReferOrTransfer(amendment, cmd.destinationFacilityId(), staffUserId);

        original.markSuperseded();
        consultationRepository.save(original);

        Visit visit = visitRepository.findById(original.getVisitId()).orElseThrow(VisitNotFoundException::new);
        auditLogService.append(staffUserId, visit.getFacilityId(), "CONSULTATION_AMENDED", "Consultation",
                amendment.getId().toString(), null, null);
        return amendment;
    }

    // A pure mistake with nothing to replace it, unlike amend(). Role bar
    // depends on the record's current status: invalidating a still-DRAFT
    // consultation only needs the same authority that created it;
    // invalidating a SIGNED one needs the same authority that could sign
    // or amend one.
    @Transactional
    public Consultation markEnteredInError(UUID id, String reason, UUID staffUserId) {
        if (!StringUtils.hasText(reason)) {
            throw new InvalidConsultationException("A reason is required.");
        }
        Consultation consultation = findConsultation(id);
        if (consultation.getStatus() != ConsultationStatus.DRAFT
                && consultation.getStatus() != ConsultationStatus.SIGNED) {
            throw new InvalidConsultationStateException(
                    "Only a draft or signed consultation can be marked entered-in-error.");
        }
        if (consultation.getStatus() == ConsultationStatus.SIGNED) {
            requireSignAccess();
        } else {
            requireDraftAccess();
        }
        consultation.markEnteredInError(reason);
        consultationRepository.save(consultation);

        Visit visit = visitRepository.findById(consultation.getVisitId()).orElseThrow(VisitNotFoundException::new);
        auditLogService.append(staffUserId, visit.getFacilityId(), "CONSULTATION_ENTERED_IN_ERROR", "Consultation",
                consultation.getId().toString(), null, null);
        return consultation;
    }

    // The visible consultation for a visit: its latest draft if one is in
    // progress, else its latest signed one, else none at all yet.
    public Optional<Consultation> getCurrent(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        Optional<Consultation> draft = consultationRepository
                .findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId, ConsultationStatus.DRAFT);
        if (draft.isPresent()) {
            return draft;
        }
        return consultationRepository.findFirstByVisitIdAndStatusOrderByCreatedAtDesc(visitId,
                ConsultationStatus.SIGNED);
    }

    // Full timeline, oldest first — DRAFT/SIGNED and SUPERSEDED/
    // ENTERED_IN_ERROR entries alike, so a reviewer can see both what's
    // current and what was corrected along the way.
    public List<Consultation> getHistory(UUID visitId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        return consultationRepository.findByVisitIdOrderByCreatedAtAsc(visitId);
    }

    public List<ConsultationDiagnosis> getDiagnoses(UUID consultationId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        return consultationDiagnosisRepository.findByConsultationIdOrderBySortOrderAsc(consultationId);
    }

    // SEND_TO_PHARMACY needs real medicine to prescribe, checked before any
    // of sign()/amend()'s other side effects run — an empty list here would
    // otherwise sign successfully, transfer the patient, and then either
    // fail confusingly inside PrescriptionService.create() (an empty items
    // list) or silently create nothing for pharmacy to dispense.
    private void requirePharmacyItemsIfNeeded(ConsultationOutcome outcome,
                                               List<PrescriptionService.PrescriptionItemInput> pharmacyItems,
                                               List<PrescriptionService.PrescriptionPurchaseItemInput> purchaseItems) {
        boolean nothingPrescribed = (pharmacyItems == null || pharmacyItems.isEmpty())
                && (purchaseItems == null || purchaseItems.isEmpty());
        if (outcome == ConsultationOutcome.SEND_TO_PHARMACY && nothingPrescribed) {
            throw new InvalidConsultationException("At least one medicine is required to send to pharmacy.");
        }
    }

    // REFER_OR_TRANSFER needs a real destination — same "check before any
    // side effects run" reasoning as requirePharmacyItemsIfNeeded() above.
    // Unlike SEND_TO_PHARMACY (always the one org-wide pharmacy,
    // FacilityService.findPharmacyFacility()), a referral can go to any
    // facility this org has, chosen by the signing clinician — there's no
    // single sensible default to fall back to.
    private void requireDestinationFacilityIfNeeded(ConsultationOutcome outcome, UUID destinationFacilityId) {
        if (outcome == ConsultationOutcome.REFER_OR_TRANSFER && destinationFacilityId == null) {
            throw new InvalidConsultationException("Choose a destination facility to refer or transfer to.");
        }
    }

    // Real physical routing, not just a recorded label: signing (or
    // amending to) SEND_TO_PHARMACY transfers the visit's own queue token
    // to the organization's pharmacy facility — the same cross-facility
    // transfer staff already use manually (QueueService.transferToken()) —
    // and releases a real prescription against the resulting destination
    // visit, so it actually appears in that facility's dispensing queue
    // (PrescriptionService.listQueue()) rather than just moving a ticket
    // nobody can act on. Runs inside the same @Transactional method as the
    // sign/amend it's called from: a missing pharmacy facility, no
    // transferable token, or a prescriber without a current HPCSA/SANC
    // registration (PrescriptionService.create()'s own gate — a doctor who
    // can't prescribe outside this flow can't prescribe through it either)
    // rolls the whole sign/amend back rather than leaving a "signed"
    // consultation whose patient was never actually sent anywhere.
    private void handleSendToPharmacy(Consultation consultation,
                                       List<PrescriptionService.PrescriptionItemInput> pharmacyItems,
                                       List<PrescriptionService.PrescriptionPurchaseItemInput> purchaseItems,
                                       UUID staffUserId) {
        if (consultation.getOutcome() != ConsultationOutcome.SEND_TO_PHARMACY) {
            return;
        }
        Facility pharmacy = facilityService.findPharmacyFacility();
        QueueService.QueueEntryView transferred = queueService.transferVisitToFacility(consultation.getVisitId(),
                pharmacy.getId(), "Sent to pharmacy from signed consultation", staffUserId);
        var prescriptionCommand = new PrescriptionService.CreatePrescriptionCommand(
                transferred.token().getVisitId(), pharmacyItems, consultation.getId(), purchaseItems);
        prescriptionService.create(prescriptionCommand, staffUserId);
    }

    // The general-purpose counterpart to handleSendToPharmacy() above — a
    // referral to any other facility in this org (a different clinic, a
    // hospital, whatever's been set up), picked by the signing clinician
    // rather than resolved automatically. No prescription side effect here;
    // unlike pharmacy, a referral doesn't inherently mean "dispense
    // something." facilityService.get() throws FacilityNotFoundException if
    // the chosen id doesn't exist in this org, rolling back the sign/amend
    // the same way an unconfigured pharmacy facility already does.
    private void handleReferOrTransfer(Consultation consultation, UUID destinationFacilityId, UUID staffUserId) {
        if (consultation.getOutcome() != ConsultationOutcome.REFER_OR_TRANSFER) {
            return;
        }
        Facility destination = facilityService.get(destinationFacilityId);
        queueService.transferVisitToFacility(consultation.getVisitId(), destination.getId(),
                "Referred/transferred from signed consultation", staffUserId);
    }

    private void clearExistingPrimary(UUID consultationId) {
        for (ConsultationDiagnosis existing : consultationDiagnosisRepository
                .findByConsultationIdOrderBySortOrderAsc(consultationId)) {
            if (existing.isPrimary()) {
                existing.setPrimary(false);
                consultationDiagnosisRepository.save(existing);
            }
        }
    }

    private void requireDraftAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(CLINICAL_ROLES, NOT_CLINICAL_ROLE_MESSAGE);
    }

    private void requireSignAccess() {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.MANAGE);
        permissionService.requireAnyRole(SIGNING_ROLES, NOT_SIGNING_ROLE_MESSAGE);
    }

    private void requireDraft(Consultation consultation) {
        if (consultation.getStatus() != ConsultationStatus.DRAFT) {
            throw new InvalidConsultationStateException(
                    "This consultation is no longer a draft; use Amend instead.");
        }
    }

    private Consultation findConsultation(UUID id) {
        return consultationRepository.findById(id).orElseThrow(ConsultationNotFoundException::new);
    }

    public record UpdateConsultationCommand(String relevantHistory, String currentMedications,
                                             AllergyStatus allergyStatus, String allergyDetail,
                                             String examinationNotes, String investigationsNotes,
                                             String treatmentPlan, String prescriptionDraft) {

        public UpdateConsultationCommand(String relevantHistory, String currentMedications,
                                         AllergyStatus allergyStatus, String allergyDetail,
                                         String examinationNotes, String investigationsNotes,
                                         String treatmentPlan) {
            this(relevantHistory, currentMedications, allergyStatus, allergyDetail, examinationNotes,
                    investigationsNotes, treatmentPlan, null);
        }
    }

    public record DiagnosisInput(String diagnosisText, boolean isPrimary, DiagnosisCertainty certainty,
                                 UUID diagnosisId) {

        public DiagnosisInput(String diagnosisText, boolean isPrimary, DiagnosisCertainty certainty) {
            this(diagnosisText, isPrimary, certainty, null);
        }
    }

    public record AmendConsultationCommand(String relevantHistory, String currentMedications,
                                            AllergyStatus allergyStatus, String allergyDetail,
                                            String examinationNotes, String investigationsNotes,
                                            String treatmentPlan, List<DiagnosisInput> diagnoses,
                                            ConsultationOutcome outcome, String outcomeNotes,
                                            String amendmentReason,
                                            List<PrescriptionService.PrescriptionItemInput> pharmacyItems,
                                            List<PrescriptionService.PrescriptionPurchaseItemInput> purchaseItems,
                                            UUID destinationFacilityId) {
    }
}
