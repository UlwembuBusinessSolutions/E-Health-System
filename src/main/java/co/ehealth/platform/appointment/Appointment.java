package co.ehealth.platform.appointment;

import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

@Entity
@Table(name = "appointments")
public class Appointment {
    @Id UUID id;
    @Column(name = "facility_id", nullable = false) UUID facilityId;
    @Column(name = "patient_id", nullable = false) UUID patientId;
    @Column(name = "assigned_staff_id") UUID assignedStaffId;
    @Column(name = "appointment_date", nullable = false) LocalDate appointmentDate;
    @Column(name = "appointment_time", nullable = false) LocalTime appointmentTime;
    @Column(name = "starts_at", nullable = false) Instant startsAt;
    @Column(nullable = false) String status = "CONFIRMED";
    @Column(name = "created_by", nullable = false) UUID createdBy;
    @Column(name = "created_at", nullable = false) Instant createdAt;
    @Column(name = "cancel_reason") String cancelReason;
    @Column(name = "notes") String notes;
    @Version long version;
    protected Appointment() {}
    Appointment(UUID id, UUID facilityId, UUID patientId, LocalDate date, LocalTime time,
                Instant startsAt, UUID actor, Instant now) {
        this.id = id; this.facilityId = facilityId; this.patientId = patientId;
        this.appointmentDate = date; this.appointmentTime = time;
        this.startsAt = startsAt; this.createdBy = actor; this.createdAt = now;
    }
}
