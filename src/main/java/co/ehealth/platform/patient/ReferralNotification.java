package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "referral_notifications", schema = "control")
public class ReferralNotification {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "source_organization_id", nullable = false)
    private UUID sourceOrganizationId;

    @Column(name = "source_schema", nullable = false, length = 63)
    private String sourceSchema;

    @Column(name = "source_organization_name", nullable = false, length = 200)
    private String sourceOrganizationName;

    @Column(name = "source_referral_id", nullable = false)
    private UUID sourceReferralId;

    @Column(name = "destination_organization_id", nullable = false)
    private UUID destinationOrganizationId;

    @Column(name = "destination_facility_id", nullable = false)
    private UUID destinationFacilityId;

    @Enumerated(EnumType.STRING)
    @Column(name = "referral_type", nullable = false, length = 20)
    private PatientReferralType referralType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ReferralNotification() {
    }

    public ReferralNotification(UUID sourceOrganizationId, String sourceSchema, String sourceOrganizationName,
                                UUID sourceReferralId, UUID destinationOrganizationId, UUID destinationFacilityId,
                                PatientReferralType referralType, Instant createdAt) {
        this.sourceOrganizationId = sourceOrganizationId;
        this.sourceSchema = sourceSchema;
        this.sourceOrganizationName = sourceOrganizationName;
        this.sourceReferralId = sourceReferralId;
        this.destinationOrganizationId = destinationOrganizationId;
        this.destinationFacilityId = destinationFacilityId;
        this.referralType = referralType;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getSourceOrganizationId() { return sourceOrganizationId; }
    public String getSourceSchema() { return sourceSchema; }
    public String getSourceOrganizationName() { return sourceOrganizationName; }
    public UUID getSourceReferralId() { return sourceReferralId; }
    public UUID getDestinationOrganizationId() { return destinationOrganizationId; }
    public UUID getDestinationFacilityId() { return destinationFacilityId; }
    public PatientReferralType getReferralType() { return referralType; }
    public Instant getCreatedAt() { return createdAt; }
}
