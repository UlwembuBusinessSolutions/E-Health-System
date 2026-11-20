package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.StaffService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
public class PatientReferralController {

    private final PatientReferralService referralService;
    private final PatientService patientService;
    private final StaffService staffService;

    public PatientReferralController(PatientReferralService referralService, PatientService patientService,
                                     StaffService staffService) {
        this.referralService = referralService;
        this.patientService = patientService;
        this.staffService = staffService;
    }

    @GetMapping("/api/v1/referral-destinations")
    public ResponseEntity<Map<String, Object>> listDestinations() {
        return ResponseEntity.ok(Map.of("items", referralService.listDestinations()));
    }

    @PostMapping("/api/v1/patients/{patientId}/referrals")
    public ResponseEntity<ReferralResponse> createDraft(@PathVariable UUID patientId,
                                                          @Valid @RequestBody ReferralRequest request,
                                                          @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        PatientReferral referral = referralService.createDraft(patientId, staff.userId(), request.toCommand());
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(referral));
    }

    @GetMapping("/api/v1/patients/{patientId}/referrals")
    public ResponseEntity<Map<String, Object>> list(@PathVariable UUID patientId) {
        List<ReferralResponse> items = referralService.list(patientId).stream().map(this::toResponse).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/patients/{patientId}/referrals/{referralId}")
    public ResponseEntity<ReferralResponse> get(@PathVariable UUID patientId, @PathVariable UUID referralId) {
        return ResponseEntity.ok(toResponse(referralService.get(patientId, referralId)));
    }

    @PatchMapping("/api/v1/patients/{patientId}/referrals/{referralId}")
    public ResponseEntity<ReferralResponse> updateDraft(@PathVariable UUID patientId,
                                                          @PathVariable UUID referralId,
                                                          @Valid @RequestBody ReferralRequest request,
                                                          @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        PatientReferral referral = referralService.updateDraft(patientId, referralId, staff.userId(),
                request.toCommand());
        return ResponseEntity.ok(toResponse(referral));
    }

    @PostMapping("/api/v1/patients/{patientId}/referrals/{referralId}/submit")
    public ResponseEntity<ReferralResponse> submit(@PathVariable UUID patientId, @PathVariable UUID referralId,
                                                     @RequestBody(required = false) ReferralActionRequest request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return transition(patientId, referralId, staff.userId(), PatientReferralStatus.SUBMITTED, request);
    }

    @PostMapping("/api/v1/patients/{patientId}/referrals/{referralId}/accept")
    public ResponseEntity<ReferralResponse> accept(@PathVariable UUID patientId, @PathVariable UUID referralId,
                                                     @RequestBody(required = false) ReferralActionRequest request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return transition(patientId, referralId, staff.userId(), PatientReferralStatus.ACCEPTED, request);
    }

    @PostMapping("/api/v1/patients/{patientId}/referrals/{referralId}/complete")
    public ResponseEntity<ReferralResponse> complete(@PathVariable UUID patientId, @PathVariable UUID referralId,
                                                       @RequestBody(required = false) ReferralActionRequest request,
                                                       @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return transition(patientId, referralId, staff.userId(), PatientReferralStatus.COMPLETED, request);
    }

    @PostMapping("/api/v1/patients/{patientId}/referrals/{referralId}/cancel")
    public ResponseEntity<ReferralResponse> cancel(@PathVariable UUID patientId, @PathVariable UUID referralId,
                                                     @RequestBody(required = false) ReferralActionRequest request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return transition(patientId, referralId, staff.userId(), PatientReferralStatus.CANCELLED, request);
    }

    @GetMapping("/api/v1/patients/{patientId}/referrals/{referralId}/history")
    public ResponseEntity<Map<String, Object>> history(@PathVariable UUID patientId, @PathVariable UUID referralId) {
        List<PatientReferralEvent> events = referralService.history(patientId, referralId);
        Map<UUID, String> names = staffService.resolveUserNames(events.stream()
                .map(PatientReferralEvent::getActorUserId).collect(java.util.stream.Collectors.toSet()));
        List<ReferralEventResponse> items = events.stream().map(event -> new ReferralEventResponse(event.getId(),
                event.getFromStatus(), event.getToStatus(), event.getActorUserId(),
                names.getOrDefault(event.getActorUserId(), "Clinical staff"), event.getNote(), event.getOccurredAt()))
                .toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @PostMapping(value = "/api/v1/patients/{patientId}/referrals/{referralId}/documents",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ReferralDocumentResponse> uploadDocument(@PathVariable UUID patientId,
                                                                     @PathVariable UUID referralId,
                                                                     @RequestParam("file") MultipartFile file,
                                                                     @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        PatientReferralDocument document = referralService.uploadDocument(patientId, referralId,
                staff.userId(), file);
        return ResponseEntity.status(HttpStatus.CREATED).body(ReferralDocumentResponse.from(document));
    }

    @GetMapping("/api/v1/patients/{patientId}/referrals/{referralId}/documents")
    public ResponseEntity<Map<String, Object>> listDocuments(@PathVariable UUID patientId,
                                                               @PathVariable UUID referralId) {
        List<ReferralDocumentResponse> items = referralService.documents(patientId, referralId).stream()
                .map(ReferralDocumentResponse::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/patients/{patientId}/referrals/{referralId}/documents/{documentId}/download-url")
    public ResponseEntity<Map<String, String>> downloadUrl(@PathVariable UUID patientId,
                                                             @PathVariable UUID referralId,
                                                             @PathVariable UUID documentId) {
        return ResponseEntity.ok(Map.of("url", referralService.getDocumentDownloadUrl(patientId, referralId,
                documentId)));
    }

    @GetMapping(value = "/api/v1/patients/{patientId}/referrals/{referralId}/print",
            produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> printable(@PathVariable UUID patientId, @PathVariable UUID referralId) {
        PatientReferral referral = referralService.get(patientId, referralId);
        Patient patient = patientService.get(patientId);
        String patientName = patient.getFirstName() + " " + patient.getLastName();
        String initiatedByName = staffService.resolveUserNames(Set.of(referral.getInitiatedByUserId()))
                .getOrDefault(referral.getInitiatedByUserId(), "Clinical staff");
        StringBuilder html = new StringBuilder("""
                <!doctype html><html lang="en"><head><meta charset="utf-8"><title>Patient referral</title>
                <style>
                body{font:15px Arial,sans-serif;color:#17212b;margin:32px;line-height:1.45}
                h1{font-size:24px;margin:0 0 6px}h2{font-size:16px;margin:24px 0 8px;border-bottom:1px solid #aaa;padding-bottom:5px}
                .muted{color:#52616b}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
                .label{font-size:11px;text-transform:uppercase;color:#52616b}.field{white-space:pre-wrap;min-height:20px}
                @media print{body{margin:16mm}.no-print{display:none}}
                </style></head><body><button class="no-print" onclick="window.print()">Print referral</button>
                <h1>Patient referral</h1><div class="muted">%s · %s · %s</div>
                <h2>Patient</h2><div class="grid"><div><div class="label">Name</div><div class="field">%s</div></div>
                <div><div class="label">MPI number</div><div class="field">%s</div></div>
                <div><div class="label">Date of birth</div><div class="field">%s</div></div>
                <div><div class="label">Contact number</div><div class="field">%s</div></div></div>
                <h2>Receiving facility</h2><div class="grid"><div><div class="label">Institution</div><div class="field">%s</div></div>
                <div><div class="label">Contact person</div><div class="field">%s</div></div>
                <div><div class="label">Telephone</div><div class="field">%s</div></div>
                <div><div class="label">Fax</div><div class="field">%s</div></div></div>
                <h2>Clinical information</h2><div class="label">Reason for referral</div><div class="field">%s</div>
                <div class="label">Clinical summary</div><div class="field">%s</div>
                <div class="label">Required medication</div><div class="field">%s</div>
                <div class="label">Medication instructions</div><div class="field">%s</div>
                <div class="label">Additional notes</div><div class="field">%s</div>
                <h2>Initiated by</h2><div class="field">%s</div>
                </body></html>
                """.formatted(escape(referral.getReferralType().name()), escape(referral.getStatus().name()),
                escape(referral.getReferralDate().toString()), escape(patientName), escape(patient.getMpiNumber()),
                escape(patient.getDateOfBirth() == null ? null : patient.getDateOfBirth().toString()),
                escape(patient.getContactNumber()),
                escape(referral.getInstitutionName()), escape(referral.getContactPerson()),
                escape(referral.getTelephoneNumber()), escape(referral.getFaxNumber()),
                escape(referral.getReason()), escape(referral.getClinicalSummary()),
                escape(referral.getRequiredMedication()), escape(referral.getMedicationInstructions()),
                escape(referral.getAdditionalNotes()), escape(initiatedByName)));
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,
                "inline; filename=patient-referral-" + referralId + ".html").body(html.toString());
    }

    private ResponseEntity<ReferralResponse> transition(UUID patientId, UUID referralId, UUID actorId,
                                                           PatientReferralStatus status,
                                                           ReferralActionRequest request) {
        PatientReferral referral = referralService.changeStatus(patientId, referralId, actorId, status,
                request == null ? null : request.note());
        return ResponseEntity.ok(toResponse(referral));
    }

    private ReferralResponse toResponse(PatientReferral referral) {
        Patient patient = patientService.get(referral.getPatientId());
        Map<UUID, String> names = staffService.resolveUserNames(Set.of(referral.getInitiatedByUserId()));
        return new ReferralResponse(referral.getId(), referral.getPatientId(), patient.getMpiNumber(),
                patient.getFirstName() + " " + patient.getLastName(), patient.getDateOfBirth(),
                patient.getContactNumber(), referral.getReferralType(), referral.getDestinationFacilityId(),
                referral.getInstitutionName(), referral.getContactPerson(), referral.getTelephoneNumber(),
                referral.getFaxNumber(), referral.getReferralDate(), referral.getReason(),
                referral.getClinicalSummary(), referral.getRequiredMedication(), referral.getMedicationInstructions(),
                referral.getAdditionalNotes(), referral.getStatus(), referral.getInitiatedByUserId(),
                names.getOrDefault(referral.getInitiatedByUserId(), "Clinical staff"), referral.getCreatedAt(),
                referral.getUpdatedAt(), referral.getSubmittedAt(), referral.getAcceptedAt(),
                referral.getCompletedAt(), referral.getCancelledAt());
    }

    private static String escape(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    public record ReferralRequest(@NotNull PatientReferralType referralType, UUID destinationFacilityId,
                                  @Size(max = 200) String institutionName,
                                  @Size(max = 160) String contactPerson,
                                  @Pattern(regexp = "^$|^\\+?[0-9 ()-]{7,30}$", message = "Enter a valid telephone number")
                                  String telephoneNumber,
                                  @Pattern(regexp = "^$|^(?i:(?:no|none|n/?a|no fax))$|^\\+?[0-9 ()-]{7,30}$",
                                          message = "Enter a valid fax number or leave it blank if unavailable")
                                  String faxNumber,
                                  LocalDate referralDate,
                                  @Size(max = 10000) String reason,
                                  @Size(max = 20000) String clinicalSummary,
                                  @Size(max = 5000) String requiredMedication,
                                  @Size(max = 5000) String medicationInstructions,
                                  @Size(max = 10000) String additionalNotes) {
        PatientReferralService.ReferralCommand toCommand() {
            return new PatientReferralService.ReferralCommand(referralType, destinationFacilityId, institutionName,
                    contactPerson, telephoneNumber, faxNumber, referralDate, reason, clinicalSummary,
                    requiredMedication, medicationInstructions, additionalNotes);
        }
    }

    public record ReferralActionRequest(@Size(max = 500) String note) { }

    public record ReferralResponse(UUID id, UUID patientId, String patientMpiNumber, String patientName,
                                   LocalDate patientDateOfBirth, String patientContactNumber,
                                   PatientReferralType referralType, UUID destinationFacilityId,
                                   String institutionName, String contactPerson, String telephoneNumber,
                                   String faxNumber, LocalDate referralDate, String reason, String clinicalSummary,
                                   String requiredMedication, String medicationInstructions, String additionalNotes,
                                   PatientReferralStatus status, UUID initiatedByUserId, String initiatedByName,
                                   Instant createdAt, Instant updatedAt, Instant submittedAt, Instant acceptedAt,
                                   Instant completedAt, Instant cancelledAt) { }

    public record ReferralEventResponse(UUID id, PatientReferralStatus fromStatus, PatientReferralStatus toStatus,
                                        UUID actorUserId, String actorName, String note, Instant occurredAt) { }

    public record ReferralDocumentResponse(UUID id, UUID referralId, UUID patientId, String originalFilename,
                                           String contentType, long fileSize, UUID uploadedByUserId,
                                           Instant uploadedAt) {
        static ReferralDocumentResponse from(PatientReferralDocument document) {
            return new ReferralDocumentResponse(document.getId(), document.getReferralId(), document.getPatientId(),
                    document.getOriginalFilename(), document.getContentType(), document.getFileSize(),
                    document.getUploadedByUserId(), document.getUploadedAt());
        }
    }
}
