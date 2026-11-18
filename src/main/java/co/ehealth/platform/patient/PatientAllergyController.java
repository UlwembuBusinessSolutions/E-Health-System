package co.ehealth.platform.patient;

import co.ehealth.platform.consultation.AllergyStatus;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// Like PatientController: no /admin prefix — recording an allergy is front-line clinical work. The service
// enforces PREG:VIEW to read and RECQ:MANAGE plus a clinical role to change.
@RestController
public class PatientAllergyController {

    private final PatientAllergyService allergyService;

    public PatientAllergyController(PatientAllergyService allergyService) {
        this.allergyService = allergyService;
    }

    @GetMapping("/api/v1/patients/{id}/allergies")
    public ResponseEntity<AllergyRecordResponse> get(@PathVariable UUID id) {
        return ResponseEntity.ok(AllergyRecordResponse.from(allergyService.get(id)));
    }

    @PostMapping("/api/v1/patients/{id}/allergies")
    public ResponseEntity<AllergyResponse> add(@PathVariable UUID id, @Valid @RequestBody AllergyRequest request,
                                               @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        PatientAllergy allergy = allergyService.add(id, request.toCommand(), staff.userId());
        return ResponseEntity.status(HttpStatus.CREATED).body(AllergyResponse.from(allergy));
    }

    @PutMapping("/api/v1/patients/{id}/allergies/{allergyId}")
    public ResponseEntity<AllergyResponse> update(@PathVariable UUID id, @PathVariable UUID allergyId,
                                                  @Valid @RequestBody AllergyRequest request,
                                                  @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(AllergyResponse.from(
                allergyService.update(id, allergyId, request.toCommand(), staff.userId())));
    }

    @PostMapping("/api/v1/patients/{id}/allergies/{allergyId}/deactivate")
    public ResponseEntity<AllergyResponse> deactivate(@PathVariable UUID id, @PathVariable UUID allergyId,
                                                      @Valid @RequestBody DeactivateAllergyRequest request,
                                                      @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(AllergyResponse.from(
                allergyService.deactivate(id, allergyId, request.reason(), staff.userId())));
    }

    @PostMapping("/api/v1/patients/{id}/allergies/{allergyId}/reactivate")
    public ResponseEntity<AllergyResponse> reactivate(@PathVariable UUID id, @PathVariable UUID allergyId,
                                                      @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(AllergyResponse.from(allergyService.reactivate(id, allergyId, staff.userId())));
    }

    // "No known allergies" / "unknown" — KNOWN is rejected by the service; it follows from recording an allergy.
    @PutMapping("/api/v1/patients/{id}/allergy-status")
    public ResponseEntity<AllergyRecordResponse> setStatus(@PathVariable UUID id,
                                                           @Valid @RequestBody SetAllergyStatusRequest request,
                                                           @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        return ResponseEntity.ok(AllergyRecordResponse.from(
                allergyService.setStatus(id, request.status(), staff.userId())));
    }

    public record AllergyRequest(
            @Size(max = 20) String allergyCode,
            UUID catalogProductId,
            @NotBlank @Size(max = 200) String allergyName,
            @NotNull AllergenType allergenType,
            @NotBlank @Size(max = 500) String reaction,
            @NotNull AllergySeverity severity,
            @NotNull LocalDate dateIdentified,
            @Size(max = 2000) String clinicalNotes) {

        PatientAllergyService.AllergyCommand toCommand() {
            return new PatientAllergyService.AllergyCommand(allergyCode, catalogProductId, allergyName, allergenType, reaction,
                    severity, dateIdentified, clinicalNotes);
        }
    }

    public record DeactivateAllergyRequest(@NotBlank @Size(max = 500) String reason) {
    }

    public record SetAllergyStatusRequest(@NotNull AllergyStatus status) {
    }

    public record AllergyResponse(UUID id, UUID patientId, String allergyCode, UUID catalogProductId, String allergyName,
                                  AllergenType allergenType, String reaction, AllergySeverity severity,
                                  LocalDate dateIdentified, String clinicalNotes, AllergyRecordStatus status,
                                  String inactiveReason, Instant inactivatedAt, UUID createdByUserId,
                                  Instant createdAt, UUID updatedByUserId, Instant updatedAt) {

        static AllergyResponse from(PatientAllergy a) {
            return new AllergyResponse(a.getId(), a.getPatientId(), a.getAllergyCode(), a.getCatalogProductId(), a.getAllergyName(),
                    a.getAllergenType(), a.getReaction(), a.getSeverity(), a.getDateIdentified(),
                    a.getClinicalNotes(), a.getStatus(), a.getInactiveReason(), a.getInactivatedAt(),
                    a.getCreatedByUserId(), a.getCreatedAt(), a.getUpdatedByUserId(), a.getUpdatedAt());
        }
    }

    public record AllergyRecordResponse(AllergyStatus status, Instant statusUpdatedAt, long activeCount,
                                        List<AllergyResponse> allergies) {

        static AllergyRecordResponse from(PatientAllergyService.AllergyRecord record) {
            return new AllergyRecordResponse(record.status(), record.statusUpdatedAt(), record.activeCount(),
                    record.allergies().stream().map(AllergyResponse::from).toList());
        }
    }
}
