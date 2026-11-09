package co.ehealth.platform.appointment;

import co.ehealth.platform.core.notification.WhatsAppMessageTemplate;
import co.ehealth.platform.core.notification.WhatsAppNotificationDispatcher;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Component
public class AppointmentWhatsAppReminderScheduler {
    private static final Logger log = LoggerFactory.getLogger(AppointmentWhatsAppReminderScheduler.class);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final OrganizationRepository organizations;
    private final FacilityRepository facilities;
    private final AppointmentRepository appointments;
    private final PatientRepository patients;
    private final WhatsAppNotificationDispatcher notifications;
    private final AppointmentReminderDeliveryRecorder deliveryRecorder;
    private final Clock clock;

    public AppointmentWhatsAppReminderScheduler(OrganizationRepository organizations, FacilityRepository facilities,
            AppointmentRepository appointments, PatientRepository patients,
            WhatsAppNotificationDispatcher notifications, AppointmentReminderDeliveryRecorder deliveryRecorder,
            Clock clock) {
        this.organizations = organizations;
        this.facilities = facilities;
        this.appointments = appointments;
        this.patients = patients;
        this.notifications = notifications;
        this.deliveryRecorder = deliveryRecorder;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${app.notifications.appointment-scan-delay-ms:60000}",
            initialDelayString = "${app.notifications.appointment-scan-initial-delay-ms:60000}")
    public void scanUpcomingAppointments() {
        var now = clock.instant();
        var dueBefore = now.plus(Duration.ofHours(24));
        for (Organization organization : organizations.findAll()) {
            if (organization.getStatus() != OrganizationStatus.ACTIVE) continue;
            TenantContext.setCurrentTenant(organization.getSchemaName());
            try {
                for (Facility facility : facilities.findAll()) {
                    if (!facility.isActive()) continue;
                    for (Appointment appointment : appointments
                            .findByFacilityIdAndStatusAndWhatsappReminderAttemptedAtIsNullAndStartsAtBetweenOrderByStartsAtAsc(
                                    facility.getId(), "CONFIRMED", now, dueBefore)) {
                        sendIfConsented(appointment, facility, now, organization.getSchemaName());
                    }
                }
            } catch (RuntimeException ex) {
                log.warn("Could not scan WhatsApp appointment reminders for tenant {}",
                        organization.getSchemaName(), ex);
            } finally {
                TenantContext.clear();
            }
        }
    }

    private void sendIfConsented(Appointment appointment, Facility facility, java.time.Instant now, String tenant) {
        Patient patient = patients.findById(appointment.patientId).orElse(null);
        if (patient == null || !patient.isWhatsAppOptedIn()
                || WhatsAppNotificationDispatcher.toE164(patient.getContactNumber()) == null) return;

        ZoneId zone = ZoneId.of(facility.getTimezone());
        var local = appointment.startsAt.atZone(zone);
        boolean sameDay = local.toLocalDate().equals(now.atZone(zone).toLocalDate());
        WhatsAppMessageTemplate template = sameDay ? WhatsAppMessageTemplate.APPOINTMENT_TODAY
                : WhatsAppMessageTemplate.APPOINTMENT_REMINDER;
        Map<String, String> values = sameDay
                ? Map.of("patient_first_name", patient.getFirstName(),
                        "appointment_time", local.format(TIME), "time_zone", facility.getTimezone(),
                        "facility_name", facility.getName(),
                        "facility_address", facility.getAddress() == null || facility.getAddress().isBlank()
                                ? facility.getName() : facility.getAddress(),
                        "appointment_reference", appointment.id.toString())
                : Map.of("patient_first_name", patient.getFirstName(),
                        "appointment_date", local.format(DATE), "appointment_time", local.format(TIME),
                        "time_zone", facility.getTimezone(), "facility_name", facility.getName(),
                        "appointment_reference", appointment.id.toString(),
                        "arrival_instruction", "Please arrive 15 minutes before your appointment.");

        // The marker makes the minute-based scanner idempotent for this appointment.
        if (appointments.markWhatsAppReminderAttemptIfPending(appointment.id, now) == 0) return;
        notifications.sendPatientAfterCommit(patient, template, values, appointment.id.toString(), (accepted, error) -> {
            if (error == null && Boolean.TRUE.equals(accepted)) return;
            TenantContext.setCurrentTenant(tenant);
            try {
                deliveryRecorder.clearFailedAttempt(appointment.id, now);
            } catch (RuntimeException ex) {
                log.warn("Could not clear failed WhatsApp reminder attempt for appointment {}", appointment.id, ex);
            } finally {
                TenantContext.clear();
            }
        });
    }
}
