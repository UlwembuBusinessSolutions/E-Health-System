package co.ehealth.platform.triage;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** An immutable set of observations captured during triage. */
@Entity
@Table(name = "triage_assessments")
public class TriageAssessment {

    @Id @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;
    @Column(name = "patient_id", nullable = false)
    private UUID patientId;
    @Column(name = "systolic_bp", nullable = false)
    private int systolicBloodPressure;
    @Column(name = "diastolic_bp", nullable = false)
    private int diastolicBloodPressure;
    @Column(name = "heart_rate", nullable = false)
    private int heartRate;
    @Column(name = "temperature_celsius", nullable = false, precision = 4, scale = 1)
    private BigDecimal temperatureCelsius;
    @Column(name = "respiratory_rate", nullable = false)
    private int respiratoryRate;
    @Enumerated(EnumType.STRING)
    @Column(name = "avpu", nullable = false, length = 20)
    private AvpuLevel avpu;
    @Column(name = "captured_at", nullable = false, updatable = false)
    private Instant capturedAt;
    @Column(name = "captured_by_user_id", nullable = false, updatable = false)
    private UUID capturedByUserId;

    protected TriageAssessment() { }

    public TriageAssessment(UUID visitId, UUID patientId, int systolicBloodPressure, int diastolicBloodPressure,
                            int heartRate, BigDecimal temperatureCelsius, int respiratoryRate, AvpuLevel avpu,
                            Instant capturedAt, UUID capturedByUserId) {
        this.visitId = visitId;
        this.patientId = patientId;
        this.systolicBloodPressure = systolicBloodPressure;
        this.diastolicBloodPressure = diastolicBloodPressure;
        this.heartRate = heartRate;
        this.temperatureCelsius = temperatureCelsius;
        this.respiratoryRate = respiratoryRate;
        this.avpu = avpu;
        this.capturedAt = capturedAt;
        this.capturedByUserId = capturedByUserId;
    }

    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public UUID getPatientId() { return patientId; }
    public int getSystolicBloodPressure() { return systolicBloodPressure; }
    public int getDiastolicBloodPressure() { return diastolicBloodPressure; }
    public int getHeartRate() { return heartRate; }
    public BigDecimal getTemperatureCelsius() { return temperatureCelsius; }
    public int getRespiratoryRate() { return respiratoryRate; }
    public AvpuLevel getAvpu() { return avpu; }
    public Instant getCapturedAt() { return capturedAt; }
    public UUID getCapturedByUserId() { return capturedByUserId; }
}
