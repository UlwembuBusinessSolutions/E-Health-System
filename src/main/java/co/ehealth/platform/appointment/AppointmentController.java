package co.ehealth.platform.appointment;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.util.*;

@RestController
public class AppointmentController {
    private final AppointmentService service;
    public AppointmentController(AppointmentService service) { this.service = service; }

    @GetMapping("/api/v1/admin/appointment-settings")
    public Map<String, Object> settings() { return Map.of("items", service.settings()); }

    @PatchMapping("/api/v1/admin/appointment-settings/{facilityId}")
    public AppointmentService.Settings update(@PathVariable UUID facilityId, @Valid @RequestBody LimitRequest request,
            @AuthenticationPrincipal AuthenticatedPrincipal actor) {
        if (request.unlimited() && request.dailyLimit() != null || !request.unlimited() && request.dailyLimit() == null)
            throw new AppointmentException(400, "Specify a daily limit or select No daily limit.");
        try {
            return service.updateLimit(facilityId, request.dailyLimit() == null ? null : request.dailyLimit().intValueExact(), actor.userId());
        } catch (ArithmeticException ex) {
            throw new AppointmentException(400, "Daily visit limit must be a positive whole number no larger than 2147483647.");
        }
    }

    @GetMapping("/api/v1/facilities/{facilityId}/appointments")
    public AppointmentService.Diary diary(@PathVariable UUID facilityId,
            @RequestParam(required = false) LocalDate date, @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) UUID assignedStaffId,
            @RequestParam(defaultValue = "false") boolean unassignedOnly,
            @RequestParam(required = false) String status) {
        return service.diary(facilityId, date, page, assignedStaffId, unassignedOnly, status);
    }

    @PostMapping("/api/v1/facilities/{facilityId}/appointments")
    @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
    public AppointmentService.Entry book(@PathVariable UUID facilityId, @Valid @RequestBody Booking request,
            @AuthenticationPrincipal AuthenticatedPrincipal actor) {
        return service.book(facilityId, request.requestId(), request.patientId(), request.date(), request.time(), request.assignedStaffId(), request.notes(), actor.userId());
    }

    @PostMapping("/api/v1/facilities/{facilityId}/appointments/{id}/reschedule")
    public AppointmentService.Entry reschedule(@PathVariable UUID facilityId, @PathVariable UUID id,
            @Valid @RequestBody Reschedule request, @AuthenticationPrincipal AuthenticatedPrincipal actor) {
        return service.reschedule(facilityId, id, request.date(), request.time(), request.assignedStaffId(), request.notes(), request.version(), actor.userId());
    }

    @PostMapping("/api/v1/facilities/{facilityId}/appointments/{id}/cancel")
    public AppointmentService.Entry cancel(@PathVariable UUID facilityId, @PathVariable UUID id,
            @Valid @RequestBody Cancel request, @AuthenticationPrincipal AuthenticatedPrincipal actor) {
        return service.cancel(facilityId, id, request.reason(), request.version(), actor.userId());
    }

    public record LimitRequest(@NotNull Boolean unlimited, @Positive java.math.BigDecimal dailyLimit) {}
    @GetMapping("/api/v1/facilities/{facilityId}/appointment-staff")
    public Map<String, Object> staff(@PathVariable UUID facilityId) { return Map.of("items", service.availableStaff(facilityId)); }

    public record Booking(@NotNull UUID requestId, @NotNull UUID patientId, @NotNull LocalDate date, @NotNull LocalTime time,
            UUID assignedStaffId, @Size(max = 1000) String notes) {}
    public record Reschedule(@NotNull LocalDate date, @NotNull LocalTime time, @NotNull @PositiveOrZero Long version,
            UUID assignedStaffId, @Size(max = 1000) String notes) {}
    public record Cancel(@NotBlank @Size(max = 500) String reason, @NotNull @PositiveOrZero Long version) {}
}
