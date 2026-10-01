package co.ehealth.platform.recq;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "waiting_time_log")
public class WaitingTimeLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false, unique = true)
    private UUID visitId;

    @Column(name = "pharmacy_visit_id")
    private UUID pharmacyVisitId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "registration_started_at", nullable = false)
    private Instant registrationStartedAt;

    @Column(name = "registration_completed_at")
    private Instant registrationCompletedAt;

    @Column(name = "triage_started_at")
    private Instant triageStartedAt;

    @Column(name = "triage_completed_at")
    private Instant triageCompletedAt;

    @Column(name = "consultation_started_at")
    private Instant consultationStartedAt;

    @Column(name = "consultation_completed_at")
    private Instant consultationCompletedAt;

    @Column(name = "pharmacy_started_at")
    private Instant pharmacyStartedAt;

    @Column(name = "pharmacy_completed_at")
    private Instant pharmacyCompletedAt;

    @Column(name = "total_waiting_minutes")
    private Long totalWaitingMinutes;

    @Column(name = "total_journey_minutes")
    private Long totalJourneyMinutes;

    @Column(name = "exceeds_120_minutes", nullable = false)
    private boolean exceeds120Minutes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected WaitingTimeLog() {
    }

    public WaitingTimeLog(
            UUID visitId,
            UUID patientId,
            UUID facilityId,
            Instant registrationStartedAt,
            Instant createdAt) {

        this.visitId = visitId;
        this.patientId = patientId;
        this.facilityId = facilityId;
        this.registrationStartedAt = registrationStartedAt;
        this.createdAt = createdAt;
        this.updatedAt = createdAt;
        this.exceeds120Minutes = false;
    }

    public UUID getId() {
        return id;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public UUID getPharmacyVisitId() {
        return pharmacyVisitId;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public Instant getRegistrationStartedAt() {
        return registrationStartedAt;
    }

    public Instant getRegistrationCompletedAt() {
        return registrationCompletedAt;
    }

    public Instant getTriageStartedAt() {
        return triageStartedAt;
    }

    public Instant getTriageCompletedAt() {
        return triageCompletedAt;
    }

    public Instant getConsultationStartedAt() {
        return consultationStartedAt;
    }

    public Instant getConsultationCompletedAt() {
        return consultationCompletedAt;
    }

    public Instant getPharmacyStartedAt() {
        return pharmacyStartedAt;
    }

    public Instant getPharmacyCompletedAt() {
        return pharmacyCompletedAt;
    }

    public Long getRegistrationDurationMinutes() {
        return durationMinutes(
                registrationStartedAt,
                registrationCompletedAt);
    }

    public Long getTriageDurationMinutes() {
        return durationMinutes(
                triageStartedAt,
                triageCompletedAt);
    }

    public Long getConsultationDurationMinutes() {
        return durationMinutes(
                consultationStartedAt,
                consultationCompletedAt);
    }

    public Long getPharmacyDurationMinutes() {
        return durationMinutes(
                pharmacyStartedAt,
                pharmacyCompletedAt);
    }

    public Long getTotalWaitingMinutes() {
        return totalWaitingMinutes;
    }

    public Long getTotalJourneyMinutes() {
        return totalJourneyMinutes;
    }

    public boolean isExceeds120Minutes() {
        return exceeds120Minutes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setPharmacyVisitId(UUID pharmacyVisitId) {
        if (this.pharmacyVisitId == null) {
            this.pharmacyVisitId = pharmacyVisitId;
        }
    }

    public void setRegistrationCompletedAt(Instant value) {
        if (registrationCompletedAt == null) {
            registrationCompletedAt = value;
        }
    }

    public void setTriageStartedAt(Instant value) {
        if (triageStartedAt == null) {
            triageStartedAt = value;
        }
    }

    public void setTriageCompletedAt(Instant value) {
        if (triageCompletedAt == null) {
            triageCompletedAt = value;
        }
    }

    public void setConsultationStartedAt(Instant value) {
        if (consultationStartedAt == null) {
            consultationStartedAt = value;
        }
    }

    public void setConsultationCompletedAt(Instant value) {
        if (consultationCompletedAt == null) {
            consultationCompletedAt = value;
        }
    }

    public void setPharmacyStartedAt(Instant value) {
        if (pharmacyStartedAt == null) {
            pharmacyStartedAt = value;
        }
    }

    public void setPharmacyCompletedAt(Instant value) {
        if (pharmacyCompletedAt == null) {
            pharmacyCompletedAt = value;
        }
    }

    public void recalculate(
            Instant now,
            long targetMinutes) {

        long waiting = 0;

        /*
         * Waiting time is the time between stages.
         *
         * We deliberately do not count time spent inside a stage
         * such as the actual triage or consultation itself.
         */

        waiting += gapMinutes(
                registrationCompletedAt,
                triageStartedAt);

        waiting += gapMinutes(
                triageCompletedAt,
                consultationStartedAt);

        waiting += gapMinutes(
                consultationCompletedAt,
                pharmacyStartedAt);

        this.totalWaitingMinutes = waiting;

        if (registrationStartedAt != null
                && pharmacyCompletedAt != null) {

            this.totalJourneyMinutes =
                    Math.max(
                            0,
                            Duration.between(
                                    registrationStartedAt,
                                    pharmacyCompletedAt)
                                    .toMinutes());
        } else {
            this.totalJourneyMinutes = null;
        }

        this.exceeds120Minutes =
                this.totalJourneyMinutes != null
                  && this.totalJourneyMinutes > targetMinutes;

        this.updatedAt = now;
    }

    private Long durationMinutes(
            Instant startedAt,
            Instant completedAt) {

        if (startedAt == null || completedAt == null) {
            return null;
        }

        return Math.max(
                0,
                Duration.between(
                        startedAt,
                        completedAt)
                        .toMinutes());
    }

    private long gapMinutes(
            Instant end,
            Instant nextStart) {

        if (end == null || nextStart == null) {
            return 0;
        }

        return Math.max(
                0,
                Duration.between(
                        end,
                        nextStart)
                        .toMinutes());
    }
}