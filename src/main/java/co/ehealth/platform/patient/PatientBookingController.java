package co.ehealth.platform.patient;

import co.ehealth.platform.appointment.AppointmentService;
import co.ehealth.platform.appointment.AppointmentStaffRepository;
import co.ehealth.platform.core.security.PatientPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/patient/booking")
public class PatientBookingController {

    private final PatientBookingService bookingService;

    public PatientBookingController(PatientBookingService bookingService) {
        this.bookingService = bookingService;
    }

    @GetMapping("/services")
    public Map<String, List<PatientBookingService.ServiceOption>> services() {
        return Map.of("items", bookingService.services());
    }

    @GetMapping("/facilities")
    public Map<String, List<PatientBookingService.FacilityOption>> facilities() {
        return Map.of("items", bookingService.facilities());
    }

    @GetMapping("/providers")
    public Map<String, List<AppointmentStaffRepository.StaffOption>> providers(@RequestParam UUID facilityId) {
        return Map.of("items", bookingService.providers(facilityId));
    }

    @GetMapping("/slots")
    public Map<String, List<LocalTime>> slots(@RequestParam UUID facilityId,
                                               @RequestParam(required = false) UUID providerId,
                                               @RequestParam LocalDate date) {
        return Map.of("items", bookingService.slots(facilityId, providerId, date));
    }

    @GetMapping("/appointments")
    public Map<String, List<AppointmentService.Entry>> myAppointments(
            @AuthenticationPrincipal PatientPrincipal principal) {
        return Map.of("items", bookingService.myAppointments(principal));
    }

    @PostMapping("/appointments")
    public ResponseEntity<AppointmentService.Entry> book(@Valid @RequestBody BookingRequest request,
                                                           @AuthenticationPrincipal PatientPrincipal principal) {
        return ResponseEntity.status(HttpStatus.CREATED).body(bookingService.book(principal, request.requestId(),
                request.facilityId(), request.serviceCode(), request.providerId(), request.date(), request.time()));
    }

    public record BookingRequest(@NotNull UUID requestId, @NotNull UUID facilityId,
                                 @NotBlank @Pattern(regexp = "GENERAL_CONSULTATION|FOLLOW_UP|CHRONIC_CARE|MATERNAL_CHILD|OCCUPATIONAL_HEALTH") String serviceCode,
                                 UUID providerId, @NotNull LocalDate date, @NotNull LocalTime time) { }
}
