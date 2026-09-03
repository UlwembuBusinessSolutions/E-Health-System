package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.Gender;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import java.util.UUID;

// No @RequestMapping("/api/v1/admin/...") — registering and finding a
// patient is front-line reception/clinical work (Admin/Reception Officer,
// Professional Nurse in the role catalogue), not admin territory the way
// staff management is. Falls through SecurityConfig's .anyRequest().authenticated()
// same as GET /api/v1/facilities and /api/v1/roles: any authenticated
// staff member, not ORG_ADMIN-gated.
@RestController
public class PatientController {

    private final PatientService patientService;
    private final PatientDocumentService patientDocumentService;
    private final PatientGuardianService patientGuardianService;

    public PatientController(PatientService patientService, PatientDocumentService patientDocumentService,
                              PatientGuardianService patientGuardianService) {
        this.patientService = patientService;
        this.patientDocumentService = patientDocumentService;
        this.patientGuardianService = patientGuardianService;
    }

    @PostMapping("/api/v1/patients")
    public ResponseEntity<PatientSummary> register(@Valid @RequestBody RegisterPatientRequest request,
                                                     @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var command = new PatientService.RegisterPatientCommand(request.firstName(), request.lastName(),
                request.idNumber(), request.address(), request.contactNumber(), request.medicalAidProvider(),
                request.medicalAidNumber(), request.passportNumber(), request.passportExpiry());
        Patient patient = patientService.register(command, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(PatientSummary.from(patient));
    }

    // Multipart, not JSON — same reasoning as StaffController.uploadPhoto():
    // file-type validation happens inside PatientDocumentService, nothing
    // here for @Valid to attach to on a MultipartFile parameter. Repeatable,
    // not one-shot — PatientDocumentService.upload()'s own why-note on why a
    // second ID copy is a new row, not a replacement.
    @PostMapping(value = "/api/v1/patients/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PatientDocumentSummary> uploadDocument(@PathVariable UUID id,
                                                                   @RequestParam("file") MultipartFile file,
                                                                   @RequestParam PatientDocumentType documentType,
                                                                   @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        PatientDocument document = patientDocumentService.upload(id, documentType, file, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(PatientDocumentSummary.from(document));
    }

    @GetMapping("/api/v1/patients/{id}/documents")
    public ResponseEntity<Map<String, Object>> listDocuments(@PathVariable UUID id) {
        List<PatientDocumentSummary> items =
                patientDocumentService.list(id).stream().map(PatientDocumentSummary::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // A fresh presigned URL per call, never the stored s3Key or a permanent
    // link — PatientDocumentService.getDownloadUrl()'s own why-note. The
    // frontend fetches this, then navigates the browser straight to the
    // returned URL; the file bytes themselves never round-trip through this
    // API the way an upload does.
    @GetMapping("/api/v1/patients/{id}/documents/{documentId}/download-url")
    public ResponseEntity<Map<String, String>> getDocumentDownloadUrl(@PathVariable UUID id,
                                                                        @PathVariable UUID documentId) {
        String url = patientDocumentService.getDownloadUrl(id, documentId);
        return ResponseEntity.ok(Map.of("url", url));
    }

    // Guardian/companion contacts — a minor, or anyone travelling with the
    // patient who may need to be reached, or (once they've also signed) act
    // on their behalf. JSON, not multipart — the signature itself is a
    // separate call below, since it's captured after the guardian already
    // exists (drawn on a pad, or added later, not necessarily up front).
    @PostMapping("/api/v1/patients/{id}/guardians")
    public ResponseEntity<GuardianSummary> addGuardian(@PathVariable UUID id,
                                                         @Valid @RequestBody AddGuardianRequest request,
                                                         @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var command = new PatientGuardianService.AddGuardianCommand(request.firstName(), request.lastName(),
                request.relationship(), request.contactNumber(), request.idNumber(), request.email());
        PatientGuardian guardian = patientGuardianService.add(id, command, staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(GuardianSummary.from(guardian));
    }

    @GetMapping("/api/v1/patients/{id}/guardians")
    public ResponseEntity<Map<String, Object>> listGuardians(@PathVariable UUID id) {
        List<GuardianSummary> items = patientGuardianService.list(id).stream().map(GuardianSummary::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // A removal, not an edit — PatientGuardianService.remove()'s own
    // why-note on why a wrong entry gets deleted and re-added rather than
    // amended in place.
    @DeleteMapping("/api/v1/patients/{id}/guardians/{guardianId}")
    public ResponseEntity<Void> removeGuardian(@PathVariable UUID id, @PathVariable UUID guardianId) {
        patientGuardianService.remove(id, guardianId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/api/v1/patients/{id}/guardians/{guardianId}/signature",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<GuardianSummary> uploadGuardianSignature(@PathVariable UUID id,
                                                                     @PathVariable UUID guardianId,
                                                                     @RequestParam("file") MultipartFile file) {
        PatientGuardian guardian = patientGuardianService.uploadSignature(id, guardianId, file);
        return ResponseEntity.ok(GuardianSummary.from(guardian));
    }

    // Same "fresh presigned URL per call" shape as
    // getDocumentDownloadUrl()/PatientDocumentService.getDownloadUrl().
    @GetMapping("/api/v1/patients/{id}/guardians/{guardianId}/signature/download-url")
    public ResponseEntity<Map<String, String>> getGuardianSignatureUrl(@PathVariable UUID id,
                                                                         @PathVariable UUID guardianId) {
        String url = patientGuardianService.getSignatureUrl(id, guardianId);
        return ResponseEntity.ok(Map.of("url", url));
    }

    // The paged roster PatientSearchPage falls back to before anyone types
    // a search query — distinct from /search below, which deliberately
    // returns nothing for an empty q (PatientService.search()'s own
    // why-note). Every filter/sort param here is optional and validated
    // defensively inside PatientService.list() itself, not here.
    @GetMapping("/api/v1/patients")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "name") String sortBy, @RequestParam(defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String gender, @RequestParam(required = false) String medicalAid,
            @RequestParam(required = false) String mpiNumber, @RequestParam(required = false) String citizenship,
            @RequestParam(required = false) String createdFrom, @RequestParam(required = false) String createdTo) {
        Page<Patient> result = patientService.list(page, size, sortBy, sortDir, gender, medicalAid, mpiNumber,
                citizenship, createdFrom, createdTo);
        List<PatientSummary> items = result.getContent().stream().map(PatientSummary::from).toList();
        Map<String, Object> body = Map.of(
                "items", items,
                "page", result.getNumber(),
                "size", result.getSize(),
                "totalItems", result.getTotalElements(),
                "totalPages", result.getTotalPages());
        return ResponseEntity.ok(body);
    }

    // PREG-US-008 — empty/blank q returns no results rather than the whole
    // roster; PatientService.search()'s own why-note.
    @GetMapping("/api/v1/patients/search")
    public ResponseEntity<Map<String, Object>> search(@RequestParam(required = false) String q) {
        List<PatientSummary> items = patientService.search(q).stream().map(PatientSummary::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    @GetMapping("/api/v1/patients/{id}")
    public ResponseEntity<PatientSummary> get(@PathVariable UUID id) {
        return ResponseEntity.ok(PatientSummary.from(patientService.get(id)));
    }

    // Admin-only — the one action on this controller that IS admin
    // territory, unlike registering/finding a patient (class-level
    // why-note): SecurityConfig's own /api/v1/admin/** -> hasRole("ORG_ADMIN")
    // matcher gates this path, layered with PatientService.update()'s own
    // PREG:MANAGE permission check (belt-and-suspenders — see that
    // method's own why-note on why that's not two independent gates in
    // practice). idNumber/dateOfBirth/gender/citizenshipStatus/mpiNumber
    // are deliberately absent from the request body — there's nothing on
    // Patient for them to set (Patient's own why-note).
    @PatchMapping("/api/v1/admin/patients/{id}")
    public ResponseEntity<PatientSummary> update(@PathVariable UUID id,
                                                   @Valid @RequestBody UpdatePatientRequest request,
                                                   @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        var command = new PatientService.UpdatePatientCommand(request.firstName(), request.lastName(),
                request.address(), request.contactNumber(), request.medicalAidProvider(),
                request.medicalAidNumber(), request.passportNumber(), request.passportExpiry(), request.reason());
        Patient patient = patientService.update(id, command, staff.userId());
        return ResponseEntity.ok(PatientSummary.from(patient));
    }

    // The read half of PREG-US-016 AC1 — without this, an append-only
    // history table nobody can see is functionally invisible; admin-only
    // for the same reason update() above is (this is where the "who
    // changed what and why" it protects actually gets read back).
    @GetMapping("/api/v1/admin/patients/{id}/history")
    public ResponseEntity<Map<String, Object>> getHistory(@PathVariable UUID id) {
        List<FieldHistoryEntry> items =
                patientService.getFieldHistory(id).stream().map(FieldHistoryEntry::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // PREG-US-017 AC2 / PREG-US-018 — the only way a record leaves active
    // use; there is still no delete endpoint anywhere in this controller.
    // Admin-only, same gating shape as update() above. One-way — no
    // unarchive endpoint exists (PatientService.archive()'s own why-note).
    @PostMapping("/api/v1/admin/patients/{id}/archive")
    public ResponseEntity<PatientSummary> archive(@PathVariable UUID id,
                                                    @Valid @RequestBody ArchivePatientRequest request,
                                                    @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        Patient patient = patientService.archive(id, request.reason(), request.deceasedDate(), staff.userId());
        return ResponseEntity.ok(PatientSummary.from(patient));
    }

    public record RegisterPatientRequest(
            @NotBlank String firstName, @NotBlank String lastName,
            @NotBlank @Pattern(regexp = "^\\d{13}$", message = "ID number must be 13 digits") String idNumber,
            @NotBlank String address,
            @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
            String medicalAidProvider, String medicalAidNumber,
            // Supplementary — see Patient.passportNumber's own why-note.
            // Loosely validated (length only): passport number formats vary
            // too widely across issuing countries for a single regex the
            // way idNumber's own SA-specific pattern above works.
            @Size(max = 20) String passportNumber, LocalDate passportExpiry) {
    }

    // idNumber is included, not masked — reception/admin staff handle ID
    // numbers routinely as part of registration and lookup, unlike a
    // password hash there's no leaked-credential risk in returning it back
    // to the same tenant's own authenticated staff.
    public record PatientSummary(UUID id, String mpiNumber, String firstName, String lastName,
                                  LocalDate dateOfBirth, Gender gender, CitizenshipStatus citizenshipStatus,
                                  String idNumber, String address, String contactNumber, String medicalAidProvider,
                                  String medicalAidNumber, String passportNumber, LocalDate passportExpiry,
                                  Instant createdAt, boolean archived, String archivedReason, Instant archivedAt,
                                  LocalDate deceasedDate) {
        static PatientSummary from(Patient p) {
            return new PatientSummary(p.getId(), p.getMpiNumber(), p.getFirstName(), p.getLastName(),
                    p.getDateOfBirth(), p.getGender(), p.getCitizenshipStatus(), p.getIdNumber(), p.getAddress(),
                    p.getContactNumber(), p.getMedicalAidProvider(), p.getMedicalAidNumber(), p.getPassportNumber(),
                    p.getPassportExpiry(), p.getCreatedAt(), p.isArchived(), p.getArchivedReason(),
                    p.getArchivedAt(), p.getDeceasedDate());
        }
    }

    // s3Key deliberately excluded — PatientDocumentService.getDownloadUrl()
    // is the only path to the actual file, never this summary.
    public record PatientDocumentSummary(UUID id, PatientDocumentType documentType, String originalFilename,
                                          String contentType, long fileSize, Instant uploadedAt) {
        static PatientDocumentSummary from(PatientDocument d) {
            return new PatientDocumentSummary(d.getId(), d.getDocumentType(), d.getOriginalFilename(),
                    d.getContentType(), d.getFileSize(), d.getUploadedAt());
        }
    }

    public record AddGuardianRequest(
            @NotBlank String firstName, @NotBlank String lastName, @NotNull GuardianRelationship relationship,
            @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
            @Pattern(regexp = "^\\d{13}$", message = "ID number must be 13 digits") String idNumber,
            // Optional — an extra reach channel, contactNumber stays the
            // required one. @Email (like @Pattern above) only validates a
            // non-null value, so leaving this out entirely is still valid.
            @Email String email) {
    }

    // hasSignature stands in for signatureS3Key the same way every other
    // *Summary here omits its own entity's s3Key — getGuardianSignatureUrl()
    // is the only path to the actual file.
    public record GuardianSummary(UUID id, String firstName, String lastName, GuardianRelationship relationship,
                                   String contactNumber, String idNumber, String email, boolean hasSignature,
                                   Instant consentedAt, Instant createdAt) {
        static GuardianSummary from(PatientGuardian g) {
            return new GuardianSummary(g.getId(), g.getFirstName(), g.getLastName(), g.getRelationship(),
                    g.getContactNumber(), g.getIdNumber(), g.getEmail(), g.getSignatureS3Key() != null,
                    g.getConsentedAt(), g.getCreatedAt());
        }
    }

    // Same field set as RegisterPatientRequest minus idNumber (immutable —
    // Patient's own why-note) plus reason, required unconditionally
    // (PatientFieldHistory's own why-note on why this doesn't try to
    // classify "clinically significant" fields per PREG-US-016 AC3).
    public record UpdatePatientRequest(
            @NotBlank String firstName, @NotBlank String lastName, @NotBlank String address,
            @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
            String medicalAidProvider, String medicalAidNumber,
            @Size(max = 20) String passportNumber, LocalDate passportExpiry,
            @NotBlank String reason) {
    }

    public record FieldHistoryEntry(UUID id, String fieldName, String oldValue, String newValue, String reason,
                                     Instant changedAt) {
        static FieldHistoryEntry from(PatientFieldHistory h) {
            return new FieldHistoryEntry(h.getId(), h.getFieldName(), h.getOldValue(), h.getNewValue(),
                    h.getReason(), h.getChangedAt());
        }
    }

    // deceasedDate is independent of reason — PREG-US-018 wants "mark
    // deceased with a date" specifically, but archiving covers other
    // reasons too (Patient.deceasedDate's own why-note), so this stays
    // optional rather than required alongside reason.
    public record ArchivePatientRequest(@NotBlank String reason, LocalDate deceasedDate) {
    }
}
