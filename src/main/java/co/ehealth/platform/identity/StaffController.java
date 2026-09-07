package co.ehealth.platform.identity;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
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

@RestController
public class StaffController {

    private final StaffService staffService;
    private final StaffPhotoService staffPhotoService;

    public StaffController(StaffService staffService, StaffPhotoService staffPhotoService) {
        this.staffService = staffService;
        this.staffPhotoService = staffPhotoService;
    }

    // The tenant app's staff roster — ORG_ADMIN-only, same
    // /api/v1/admin/** matcher as creation. Not open to any authenticated
    // staff member the way GET /api/v1/facilities or /api/v1/organization
    // are: a full roster (contact details, roles, last login) is admin
    // territory, not something every staff member needs to see about their
    // colleagues.
    @GetMapping("/api/v1/admin/staff")
    public ResponseEntity<Map<String, Object>> list() {
        List<StaffRosterEntry> items = staffService.listStaff().stream().map(StaffRosterEntry::from).toList();
        return ResponseEntity.ok(Map.of("items", items));
    }

    // Covered by SecurityConfig's existing /api/v1/admin/** -> ORG_ADMIN
    // matcher — no security config change needed for this.
    @PostMapping("/api/v1/admin/staff")
    public ResponseEntity<StaffSummary> create(@Valid @RequestBody CreateStaffRequest request,
                                                @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        // additionalFacilityIds is optional in the request body — a caller
        // that omits it entirely gets treated the same as one that sends [].
        List<UUID> additionalFacilityIds =
                request.additionalFacilityIds() == null ? List.of() : request.additionalFacilityIds();
        var command = new StaffService.CreateStaffCommand(
                request.firstName(), request.lastName(), request.employeeNumber(), request.idNumber(),
                request.email(), request.contactNumber(), request.gender(), request.dateOfBirth(),
                request.employmentStartDate(), request.employmentType(), request.managerId(), request.facilityId(),
                additionalFacilityIds, request.department(), request.designation(), request.roleId(),
                request.sancNumber(), request.sancExpiryDate(), request.hpcsaNumber(), request.hpcsaExpiryDate(),
                request.sapcNumber(), request.sapcExpiryDate(),
                request.emergencyContactName(), request.emergencyContactRelationship(),
                request.emergencyContactPhone());
        User created = staffService.createStaff(command, admin.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(StaffSummary.from(created));
    }

    // Same /api/v1/admin/** -> ORG_ADMIN matcher as create() above — any
    // org admin can reset any staff member's password, including another
    // admin's (the actual fix for "an admin is locked out and there's no
    // other way back in" at the tenant level, same problem
    // PlatformController's platform-side admin-reset endpoint solves for
    // when there's nobody left inside the org at all).
    @PostMapping("/api/v1/admin/staff/{id}/reset-password")
    public ResponseEntity<ResetPasswordResponse> resetPassword(@PathVariable UUID id,
                                                                 @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        String temporaryPassword = staffService.resetPassword(id, admin.userId());
        return ResponseEntity.ok(new ResetPasswordResponse(temporaryPassword));
    }

    @PostMapping("/api/v1/admin/staff/{id}/enable")
    public ResponseEntity<Void> enable(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        staffService.setEnabled(id, true, admin.userId());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/admin/staff/{id}/disable")
    public ResponseEntity<Void> disable(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        staffService.setEnabled(id, false, admin.userId());
        return ResponseEntity.noContent().build();
    }

    // Distinct from enable() above: enable/disable toggle ACTIVE/DISABLED
    // (a deliberate admin decision), this reverses LOCKED (an automatic
    // consequence of failed login attempts) — the two statuses are never
    // meant to be flipped by the same lever.
    @PostMapping("/api/v1/admin/staff/{id}/unlock")
    public ResponseEntity<Void> unlock(@PathVariable UUID id, @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        staffService.unlockAccount(id, admin.userId());
        return ResponseEntity.noContent().build();
    }

    // temporaryPassword returned exactly once — same discipline as
    // StaffSummary's own creation-time counterpart never re-exposing it.
    public record ResetPasswordResponse(String temporaryPassword) {
    }

    // A staff member leaving is its own operation, not an update to the
    // creation form — see the comment on StaffService.offboardStaff() for
    // why employmentEndDate isn't part of CreateStaffRequest.
    @PostMapping("/api/v1/admin/staff/{id}/offboard")
    public ResponseEntity<Void> offboard(@PathVariable UUID id, @Valid @RequestBody OffboardStaffRequest request,
                                          @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        staffService.offboardStaff(id, request.employmentEndDate(), admin.userId());
        return ResponseEntity.noContent().build();
    }

    // Separate from staff creation on purpose — race/disability/background-
    // check/health-clearance data arrives later and is more sensitive than
    // the rest of the profile. Callable repeatedly as new information comes
    // in; StaffService.recordComplianceDetails() upserts rather than
    // erroring on a second call.
    @PostMapping("/api/v1/admin/staff/{id}/compliance")
    public ResponseEntity<Void> recordCompliance(@PathVariable UUID id,
                                                   @Valid @RequestBody RecordComplianceRequest request,
                                                   @AuthenticationPrincipal AuthenticatedPrincipal admin) {
        var command = new StaffService.RecordComplianceCommand(request.race(), request.disabilityStatus(),
                request.backgroundCheckDate(), request.backgroundCheckStatus(),
                request.occupationalHealthClearanceDate());
        staffService.recordComplianceDetails(id, command, admin.userId());
        return ResponseEntity.noContent().build();
    }

    // Multipart, not JSON — deliberately no @Valid/@RequestBody. File-type
    // validation happens inside StaffPhotoService rather than Bean
    // Validation annotations, which have nothing to attach to on a
    // MultipartFile parameter. Callable any time after creation, not just
    // once — a second upload replaces the first (see StaffPhotoService's
    // why-note on the deterministic S3 key).
    @PostMapping(value = "/api/v1/admin/staff/{id}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PhotoUploadResponse> uploadPhoto(@PathVariable UUID id,
                                                            @RequestParam("file") MultipartFile file) {
        String url = staffPhotoService.uploadPhoto(id, file);
        return ResponseEntity.ok(new PhotoUploadResponse(url));
    }

    public record CreateStaffRequest(
            @NotBlank String firstName, @NotBlank String lastName,
            @NotBlank @Size(max = 30) String employeeNumber,
            @Pattern(regexp = "^[0-9]{13}$") String idNumber,
            @NotBlank @Email String email,
            @NotBlank @Pattern(regexp = "^\\+?[0-9]{9,15}$") String contactNumber,
            @NotNull Gender gender, LocalDate dateOfBirth, LocalDate employmentStartDate,
            EmploymentType employmentType, UUID managerId,
            @NotNull UUID facilityId, List<UUID> additionalFacilityIds,
            String department, String designation, @NotNull UUID roleId,
            String sancNumber, LocalDate sancExpiryDate, String hpcsaNumber, LocalDate hpcsaExpiryDate,
            String sapcNumber, LocalDate sapcExpiryDate,
            String emergencyContactName, String emergencyContactRelationship,
            @Pattern(regexp = "^\\+?[0-9]{9,15}$") String emergencyContactPhone) {
    }

    public record OffboardStaffRequest(@NotNull LocalDate employmentEndDate) {
    }

    // race/disabilityStatus deliberately not @NotBlank — declining to
    // answer has to be representable, not just "not asked yet."
    public record RecordComplianceRequest(
            @Pattern(regexp = "^(AFRICAN|COLOURED|INDIAN|WHITE|OTHER|PREFER_NOT_TO_SAY)$") String race,
            @Pattern(regexp = "^(NONE|DISABLED|PREFER_NOT_TO_SAY)$") String disabilityStatus,
            LocalDate backgroundCheckDate, BackgroundCheckStatus backgroundCheckStatus,
            LocalDate occupationalHealthClearanceDate) {
    }

    public record PhotoUploadResponse(String profilePhotoUrl) {
    }

    // Never return the User entity itself — it carries passwordHash, and
    // Jackson serializes every field it can see. Mapping to a DTO here
    // isn't optional polish; it's the only thing standing between this
    // endpoint and a leaked hash in a JSON response.
    public record StaffSummary(UUID id, String employeeNumber, String email, String firstName, String lastName,
                                UUID facilityId, boolean mustChangePassword) {
        static StaffSummary from(User u) {
            return new StaffSummary(u.getId(), u.getEmployeeNumber(), u.getEmail(), u.getFirstName(),
                    u.getLastName(), u.getFacilityId(), u.isMustChangePassword());
        }
    }

    // The roster's own row shape — roles is a list because user_roles has
    // no cardinality constraint (StaffService.StaffRosterEntry's own
    // why-note), even though a typical staff member holds exactly one today.
    public record StaffRosterEntry(UUID id, String employeeNumber, String firstName, String lastName, String email,
                                    String contactNumber, List<String> roles, UUID facilityId, String status,
                                    Instant lastLoginAt) {
        static StaffRosterEntry from(StaffService.StaffRosterEntry entry) {
            return new StaffRosterEntry(entry.id(), entry.employeeNumber(), entry.firstName(), entry.lastName(),
                    entry.email(), entry.contactNumber(), entry.roles(), entry.facilityId(),
                    entry.status().name(), entry.lastLoginAt());
        }
    }
}
