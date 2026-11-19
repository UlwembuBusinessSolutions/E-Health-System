package co.ehealth.platform.laboratory;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "laboratory_investigations")
public class LaboratoryInvestigation {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "visit_id", nullable = false)
    private UUID visitId;

    @Column(name = "investigation_date", nullable = false)
    private LocalDate investigationDate;

    @Column(name = "test_name", nullable = false, length = 200)
    private String testName;

    @Column(name = "test_results", nullable = false, columnDefinition = "TEXT")
    private String testResults;

    @Column(name = "signed_by_user_id", nullable = false)
    private UUID signedByUserId;

    @Column(name = "signed_at", nullable = false)
    private Instant signedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected LaboratoryInvestigation() {
    }

    public LaboratoryInvestigation(UUID visitId, LocalDate investigationDate, String testName, String testResults,
                                   UUID signedByUserId, Instant signedAt) {
        this.visitId = visitId;
        this.investigationDate = investigationDate;
        this.testName = testName;
        this.testResults = testResults;
        this.signedByUserId = signedByUserId;
        this.signedAt = signedAt;
        this.createdAt = signedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getVisitId() {
        return visitId;
    }

    public LocalDate getInvestigationDate() {
        return investigationDate;
    }

    public String getTestName() {
        return testName;
    }

    public String getTestResults() {
        return testResults;
    }

    public UUID getSignedByUserId() {
        return signedByUserId;
    }

    public Instant getSignedAt() {
        return signedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
