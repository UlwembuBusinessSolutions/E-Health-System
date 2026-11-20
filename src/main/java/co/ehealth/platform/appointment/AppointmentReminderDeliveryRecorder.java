package co.ehealth.platform.appointment;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.Duration;
import java.util.UUID;

@Service
public class AppointmentReminderDeliveryRecorder {
    private final AppointmentRepository appointments;

    public AppointmentReminderDeliveryRecorder(AppointmentRepository appointments) {
        this.appointments = appointments;
    }

    @Transactional
    public void clearFailedAttempt(UUID appointmentId, Instant attemptedAt) {
        appointments.findById(appointmentId).ifPresent(appointment -> {
            Instant storedAttempt = appointment.whatsappReminderAttemptedAt;
            if (storedAttempt != null
                    && Duration.between(storedAttempt, attemptedAt).abs().compareTo(Duration.ofMillis(1)) < 0) {
                appointment.clearWhatsAppReminderAttempt();
                appointments.save(appointment);
            }
        });
    }
}
