package co.ehealth.platform.facility;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Patient record API — compliance-driven endpoints that enforce immutability
// and archiving-only withdrawal. Every write operation is authorized and
// audit-logged. Deletion is not an available operation at any layer.
//
// Routes: /api/v1/records
// Authorization: All endpoints require ORG_ADMIN role (organization-level
// admin, not platform admin). @PreAuthorize("hasRole('ORG_ADMIN')") on write
// operations; read operations available to any authenticated staff member
// (AuthenticatedPrincipal present) but may require additional authorization
// checks at the service/repository level (facility access, etc.) — to be
// added by the clinical module owning patient access rules.
@RestController
public class PatientRecordController {

    private final PatientRecordService recordService;

    public PatientRecordController(PatientRecordService recordService) {
        this.recordService = recordService;
    }

    // ============ CREATE ============

    // POST /api/v1/records — create a new patient record
    // Authorization: ORG_ADMIN only
    // Request: CreatePatientRecordRequest (MRN, names, DOB)
    // Response: 201 CREATED with the newly created record
    @PostMapping("/api/v1/records")
    @PreAuthorize("hasRole('ORG_ADMIN')")
    public ResponseEntity<PatientRecordResponse> createRecord(
            @Valid @RequestBody CreatePatientRecordRequest request,
            @org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedPrincipal admin,
            HttpServletRequest httpRequest) {

        PatientRecord created = recordService.createRecord(
                request.mrn(), request.firstName(), request.lastName(),
                request.dateOfBirth(), admin.userId(), httpRequest.getRemoteAddr());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new PatientRecordResponse(created));
    }

    // ============ READ ============

    // GET /api/v1/records/{id} — fetch a single record by ID
    // Authorization: Authenticated staff (any role with JWT token)
    // Response: 200 OK with record, or 404 NOT FOUND
    // Note: Authorization check (facility access, etc.) to be added by
    // clinical module; this layer just verifies the record exists.
    @GetMapping("/api/v1/records/{id}")
    public ResponseEntity<PatientRecordResponse> getRecord(@PathVariable UUID id) {
        PatientRecord record = recordService.getRecord(id);
        return ResponseEntity.ok(new PatientRecordResponse(record));
    }

    // GET /api/v1/records?status=ACTIVE — list records
    // Authorization: Authenticated staff (any role with JWT token)
    // Query param: status (ACTIVE|ARCHIVED) — defaults to ACTIVE if omitted
    // Response: 200 OK with list of records
    // Note: No pagination yet; same as OrganizationProvisioningService's
    // listOrganizations() — added once volume grows.
    @GetMapping("/api/v1/records")
    public ResponseEntity<Map<String, Object>> listRecords(
            @RequestParam(required = false, defaultValue = "ACTIVE") String status) {

        List<PatientRecord> records;
        if ("ARCHIVED".equalsIgnoreCase(status)) {
            records = recordService.listArchivedRecords();
        } else {
            records = recordService.listActiveRecords();
        }

        return ResponseEntity.ok(Map.of(
                "items", records.stream().map(PatientRecordResponse::new).toList(),
                "total", records.size()));
    }

    // GET /api/v1/records/search?q={name fragment} — search ACTIVE records
    // by name
    // Authorization: Authenticated staff (any role with JWT token)
    // Query param: q (name fragment, case-insensitive)
    // Response: 200 OK with matching records
    @GetMapping("/api/v1/records/search")
    public ResponseEntity<Map<String, Object>> searchRecords(
            @RequestParam(value = "q", required = false) String query) {

        List<PatientRecord> results;
        if (query == null || query.isBlank()) {
            results = List.of();
        } else {
            results = recordService.searchActiveRecordsByName(query);
        }

        return ResponseEntity.ok(Map.of(
                "items", results.stream().map(PatientRecordResponse::new).toList(),
                "total", results.size()));
    }

    // ============ DELETE (BLOCKED, PER BR-PREG-150) ============

    // DELETE /api/v1/records/{id} — always rejected with 403, for every
    // role including Super Admin. No @PreAuthorize role restriction here:
    // unlike archive (ORG_ADMIN-only) or create (ORG_ADMIN-only), deletion
    // has no authorized caller at all, so there's no role to check against
    // — every authenticated request hits the same rejection path.
    //
    // Without this explicit mapping, Spring returns 405 METHOD_NOT_ALLOWED
    // before any application code runs — which fails the story's AC
    // (403, audit-logged) on two counts: wrong status code, and no audit
    // entry, since nothing here ever executes.
    @DeleteMapping("/api/v1/records/{id}")
    public ResponseEntity<Void> deleteRecord(
            @PathVariable UUID id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedPrincipal principal,
            HttpServletRequest httpRequest) {

        recordService.rejectDeletion(id, principal.userId(), httpRequest.getRemoteAddr());
        // Unreachable — rejectDeletion() always throws — but the compiler
        // needs a return path.
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }

    // ============ ARCHIVE (the only state change) ============

    // POST /api/v1/records/{id}/archive — withdraw a record from active use
    // Authorization: ORG_ADMIN only
    // Response: 204 NO CONTENT on success, 404 NOT FOUND or 409 CONFLICT
    // Throws:
    // - RecordNotFoundException (404) if record doesn't exist
    // - RecordAlreadyArchivedException (409) if already archived
    // - IllegalArgumentException (500) if archiving staff doesn't exist (shouldn't
    // happen in practice — indicates a data integrity issue)
    //
    // Note: No DELETE endpoint exists. This is the only way to remove a record
    // from active use. HTTP DELETE is not wired at all, per compliance requirement
    // BR-PREG-150.
    @PostMapping("/api/v1/records/{id}/archive")
    @PreAuthorize("hasRole('ORG_ADMIN')")
    public ResponseEntity<Void> archiveRecord(
            @PathVariable UUID id,
            @org.springframework.security.core.annotation.AuthenticationPrincipal AuthenticatedPrincipal admin,
            HttpServletRequest httpRequest) {

        recordService.archiveRecord(id, admin.userId(), httpRequest.getRemoteAddr());
        return ResponseEntity.noContent().build();
    }

    // DELETE is now explicitly mapped (see deleteRecord() above) so the
    // rejection is a deterministic, audited 403 rather than relying on
    // Spring's default 405 for an unmapped method.
    // /api/v1/records/{id},
    // Spring responds with 405 METHOD_NOT_ALLOWED before this controller even runs.
    // If somehow a DELETE call reaches the service layer (via direct code, not
    // HTTP),
    // PatientRecordService.deleteRecord() throws UnsupportedOperationException.

    // ============ Request/Response DTOs ============

    public record CreatePatientRecordRequest(
            @NotBlank(message = "MRN is required") @Pattern(regexp = "^[A-Z0-9]{5,50}$", message = "MRN must be 5-50 alphanumeric characters") String mrn,

            @NotBlank(message = "First name is required") @jakarta.validation.constraints.Size(min = 1, max = 100) String firstName,

            @NotBlank(message = "Last name is required") @jakarta.validation.constraints.Size(min = 1, max = 100) String lastName,

            LocalDate dateOfBirth) {
    }

    public record PatientRecordResponse(
            UUID id,
            String mrn,
            String firstName,
            String lastName,
            LocalDate dateOfBirth,
            String status, // "ACTIVE" or "ARCHIVED"
            java.time.Instant archivedAt,
            java.util.UUID archivedBy,
            java.time.Instant createdAt,
            java.time.Instant updatedAt) {

        // Constructor from entity — for ease of use in endpoints.
        public PatientRecordResponse(PatientRecord record) {
            this(
                    record.getId(),
                    record.getMrn(),
                    record.getFirstName(),
                    record.getLastName(),
                    record.getDateOfBirth(),
                    record.getStatus().name(),
                    record.getArchivedAt(),
                    record.getArchivedBy(),
                    record.getCreatedAt(),
                    record.getUpdatedAt());
        }
    }
}
