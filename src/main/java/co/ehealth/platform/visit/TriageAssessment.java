package co.ehealth.platform.visit;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "triage_assessments")
public class TriageAssessment {
    @Id
    @GeneratedValue
    private UUID id;
    @Column(name = "visit_id", nullable = false)
    private UUID visitId;
    @Column(name = "respiratory_rate", nullable = false)
    private int respiratoryRate;
    @Column(name = "pulse_rate", nullable = false)
    private int pulseRate;
    @Column(name = "systolic_bp", nullable = false)
    private int systolicBp;
    @Column(nullable = false, precision = 4, scale = 1)
    private BigDecimal temperature;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private Avpu avpu;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private Mobility mobility;
    @Column(nullable = false)
    private boolean trauma;
    @Column(nullable = false)
    private boolean deceased;
    @Column(nullable = false)
    private int tewsScore;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    private TriageColour calculatedColour;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 10)
    private TriageColour assignedColour;
    @Column(name = "sla_minutes")
    private Integer slaMinutes;
    @Column(name = "override_reason", length = 500)
    private String overrideReason;
    @Column(name = "recorded_by_user_id")
    private UUID recordedByUserId;
    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    protected TriageAssessment() {}

    public TriageAssessment(UUID visitId, TriageVitals v, int score, TriageColour calculated,
                            TriageColour assigned, String overrideReason, UUID recordedByUserId, Instant recordedAt) {
        this.visitId = visitId;
        this.respiratoryRate = v.respiratoryRate();
        this.pulseRate = v.pulseRate();
        this.systolicBp = v.systolicBp();
        this.temperature = v.temperature();
        this.avpu = v.avpu();
        this.mobility = v.mobility();
        this.trauma = v.trauma();
        this.deceased = v.deceased();
        this.tewsScore = score;
        this.calculatedColour = calculated;
        this.assignedColour = assigned;
        this.slaMinutes = assigned.getSlaMinutes();
        this.overrideReason = overrideReason;
        this.recordedByUserId = recordedByUserId;
        this.recordedAt = recordedAt;
    }

    public UUID getId() { return id; }
    public UUID getVisitId() { return visitId; }
    public int getTewsScore() { return tewsScore; }
    public TriageColour getCalculatedColour() { return calculatedColour; }
    public TriageColour getAssignedColour() { return assignedColour; }
    public Integer getSlaMinutes() { return slaMinutes; }
    public String getOverrideReason() { return overrideReason; }
    public Instant getRecordedAt() { return recordedAt; }
}
