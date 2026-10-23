package co.ehealth.platform.identity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.UUID;

// Deliberately not @OneToOne to User — no JPA relationship at all, same
// plain-UUID-foreign-key style every other cross-entity reference in this
// codebase uses (facilityId, managerId, roleId...). A row here only exists
// once something is actually recorded — see StaffService.recordComplianceDetails()
// — not automatically alongside every User.
@Entity
@Table(name = "user_compliance_details")
public class UserComplianceDetails {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(length = 30)
    private String race;

    @Column(name = "disability_status", length = 20)
    private String disabilityStatus;

    @Column(name = "background_check_date")
    private LocalDate backgroundCheckDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "background_check_status", length = 20)
    private BackgroundCheckStatus backgroundCheckStatus;

    @Column(name = "occupational_health_clearance_date")
    private LocalDate occupationalHealthClearanceDate;

    protected UserComplianceDetails() {
    }

    public UserComplianceDetails(UUID userId) {
        this.userId = userId;
    }

    public void setRace(String race) {
        this.race = race;
    }

    public void setDisabilityStatus(String disabilityStatus) {
        this.disabilityStatus = disabilityStatus;
    }

    public void setBackgroundCheckDate(LocalDate backgroundCheckDate) {
        this.backgroundCheckDate = backgroundCheckDate;
    }

    public void setBackgroundCheckStatus(BackgroundCheckStatus status) {
        this.backgroundCheckStatus = status;
    }

    public void setOccupationalHealthClearanceDate(LocalDate date) {
        this.occupationalHealthClearanceDate = date;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getRace() {
        return race;
    }

    public String getDisabilityStatus() {
        return disabilityStatus;
    }

    public LocalDate getBackgroundCheckDate() {
        return backgroundCheckDate;
    }

    public BackgroundCheckStatus getBackgroundCheckStatus() {
        return backgroundCheckStatus;
    }

    public LocalDate getOccupationalHealthClearanceDate() {
        return occupationalHealthClearanceDate;
    }
}
