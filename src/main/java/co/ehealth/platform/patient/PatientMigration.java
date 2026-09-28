package co.ehealth.platform.patient;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// Lives in the ORIGIN tenant's own schema — it's the tenant retaining the
// "full ongoing access" view (decision #3), so this is where the durable
// link to the destination has to live. Append-only, identifiers only — no
// demographic snapshot: PatientMigrationService.getDestinationView() reads
// the LIVE destination record through these ids on every call rather than
// freezing a copy here, per decision #3's own "not a frozen snapshot"
// framing. patientId is unique: migration is one-way, no re-migration (same
// philosophy as Patient.archive() having no matching un-archive).
@Entity
@Table(name = "patient_migrations")
public class PatientMigration {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "patient_id", nullable = false, unique = true)
    private UUID patientId;

    @Column(name = "destination_organization_id", nullable = false)
    private UUID destinationOrganizationId;

    @Column(name = "destination_patient_id", nullable = false)
    private UUID destinationPatientId;

    @Column(name = "destination_facility_id", nullable = false)
    private UUID destinationFacilityId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "migrated_by_user_id")
    private UUID migratedByUserId;

    @Column(name = "migrated_at", nullable = false, updatable = false)
    private Instant migratedAt;

    protected PatientMigration() {
    }

    public PatientMigration(UUID patientId, UUID destinationOrganizationId, UUID destinationPatientId,
                             UUID destinationFacilityId, String reason, UUID migratedByUserId, Instant migratedAt) {
        this.patientId = patientId;
        this.destinationOrganizationId = destinationOrganizationId;
        this.destinationPatientId = destinationPatientId;
        this.destinationFacilityId = destinationFacilityId;
        this.reason = reason;
        this.migratedByUserId = migratedByUserId;
        this.migratedAt = migratedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public UUID getDestinationOrganizationId() {
        return destinationOrganizationId;
    }

    public UUID getDestinationPatientId() {
        return destinationPatientId;
    }

    public UUID getDestinationFacilityId() {
        return destinationFacilityId;
    }

    public String getReason() {
        return reason;
    }

    public UUID getMigratedByUserId() {
        return migratedByUserId;
    }

    public Instant getMigratedAt() {
        return migratedAt;
    }
}
