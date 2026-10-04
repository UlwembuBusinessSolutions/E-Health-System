package co.ehealth.platform.pharmacy.dispensing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// A request to the prescriber to allow a different product for one item.
// The substitute is only ever dispensed once status is APPROVED; REQUESTED
// and REJECTED rows leave dispensing on the prescribed product.
@Entity
@Table(name = "prescription_substitutions")
public class PrescriptionSubstitution {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_item_id", nullable = false, updatable = false)
    private UUID prescriptionItemId;

    @Column(name = "substitute_product_id", nullable = false, updatable = false)
    private UUID substituteProductId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private SubstitutionStatus status;

    @Column(name = "requested_by", nullable = false, updatable = false)
    private UUID requestedBy;

    @Column(name = "requested_at", nullable = false, updatable = false)
    private Instant requestedAt;

    @Column(name = "decided_by")
    private UUID decidedBy;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(length = 500)
    private String note;

    protected PrescriptionSubstitution() {
    }

    public PrescriptionSubstitution(UUID prescriptionItemId, UUID substituteProductId, UUID requestedBy,
                                     Instant requestedAt) {
        this.prescriptionItemId = prescriptionItemId;
        this.substituteProductId = substituteProductId;
        this.status = SubstitutionStatus.REQUESTED;
        this.requestedBy = requestedBy;
        this.requestedAt = requestedAt;
    }

    public void decide(SubstitutionStatus decision, UUID decidedBy, Instant decidedAt, String note) {
        this.status = decision;
        this.decidedBy = decidedBy;
        this.decidedAt = decidedAt;
        this.note = note;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionItemId() {
        return prescriptionItemId;
    }

    public UUID getSubstituteProductId() {
        return substituteProductId;
    }

    public SubstitutionStatus getStatus() {
        return status;
    }

    public Instant getRequestedAt() {
        return requestedAt;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public String getNote() {
        return note;
    }
}
