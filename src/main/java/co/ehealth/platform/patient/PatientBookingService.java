package co.ehealth.platform.patient;

import co.ehealth.platform.appointment.AppointmentService;
import co.ehealth.platform.appointment.AppointmentStaffRepository;
import co.ehealth.platform.core.security.PatientPrincipal;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.facility.FacilityType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Service
public class PatientBookingService {

    private static final List<ServiceOption> SERVICES = List.of(
            new ServiceOption("GENERAL_CONSULTATION", "General consultation", "Everyday health concerns and new symptoms."),
            new ServiceOption("FOLLOW_UP", "Follow-up visit", "Review progress or continue an existing care plan."),
            new ServiceOption("CHRONIC_CARE", "Chronic care", "Ongoing support for long-term health conditions."),
            new ServiceOption("MATERNAL_CHILD", "Maternal and child health", "Care for pregnancy, babies, and children."),
            new ServiceOption("OCCUPATIONAL_HEALTH", "Occupational health", "Workplace health assessments and support."));

    private final PatientAccountRepository accounts;
    private final FacilityRepository facilities;
    private final AppointmentService appointments;

    public PatientBookingService(PatientAccountRepository accounts, FacilityRepository facilities,
                                 AppointmentService appointments) {
        this.accounts = accounts;
        this.facilities = facilities;
        this.appointments = appointments;
    }

    public List<ServiceOption> services() {
        return SERVICES;
    }

    @Transactional(readOnly = true)
    public List<FacilityOption> facilities() {
        return facilities.findByActiveTrueOrderByNameAsc().stream()
                .filter(facility -> facility.getType() == FacilityType.CLINIC || facility.getType() == FacilityType.HOSPITAL)
                .map(facility -> new FacilityOption(facility.getId(), facility.getName(), facility.getAddress(),
                        facility.getPhone(), facility.getOperatingHours(), facility.getTimezone()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AppointmentStaffRepository.StaffOption> providers(UUID facilityId) {
        return appointments.patientBookingProviders(facilityId);
    }

    @Transactional(readOnly = true)
    public List<LocalTime> slots(UUID facilityId, UUID providerId, LocalDate date) {
        return appointments.patientBookingSlots(facilityId, providerId, date);
    }

    @Transactional
    public AppointmentService.Entry book(PatientPrincipal principal, UUID requestId, UUID facilityId,
                                         String serviceCode, UUID providerId, LocalDate date, LocalTime time) {
        PatientAccount account = accounts.findById(principal.patientAccountId())
                .orElseThrow(PatientNotFoundException::new);
        if (account.getPatientId() == null) throw new PatientNotFoundException();
        return appointments.bookFromPatientPortal(facilityId, requestId, account.getPatientId(), account.getId(),
                date, time, providerId, serviceCode);
    }

    @Transactional(readOnly = true)
    public List<AppointmentService.Entry> myAppointments(PatientPrincipal principal) {
        PatientAccount account = accounts.findById(principal.patientAccountId())
                .orElseThrow(PatientNotFoundException::new);
        if (account.getPatientId() == null) throw new PatientNotFoundException();
        return appointments.patientBookings(account.getPatientId());
    }

    public record ServiceOption(String code, String name, String description) { }
    public record FacilityOption(UUID id, String name, String address, String phone,
                                 String operatingHours, String timezone) { }
}
