package co.ehealth.platform.pharmacy.purchasing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// What the pharmacy asked one supplier to send. Never edited after it is
// created and never moves stock; the goods arriving are a separate receipt.
@Entity
@Table(name = "pharmacy_purchase_orders")
public class PurchaseOrder {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "po_number", nullable = false, updatable = false, length = 20)
    private String poNumber;

    @Column(name = "facility_id", nullable = false, updatable = false)
    private UUID facilityId;

    @Column(name = "supplier_id", nullable = false)
    private UUID supplierId;

    @Column(name = "expected_delivery", updatable = false)
    private LocalDate expectedDelivery;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, updatable = false, length = 200)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PurchaseOrderStatus status = PurchaseOrderStatus.DRAFT;

    @Column(name = "authorized_by")
    private UUID authorizedBy;

    @Column(name = "authorized_by_name", length = 200)
    private String authorizedByName;

    @Column(name = "authorized_at")
    private Instant authorizedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "catalogue_reference", length = 200)
    private String catalogueReference;

    @Column(name = "transmission_error", length = 500)
    private String transmissionError;

    public PurchaseOrderStatus getStatus() { return status; }
    public UUID getAuthorizedBy() { return authorizedBy; }
    public String getAuthorizedByName() { return authorizedByName; }
    public Instant getAuthorizedAt() { return authorizedAt; }
    public Instant getSubmittedAt() { return submittedAt; }
    public String getCatalogueReference() { return catalogueReference; }
    public String getTransmissionError() { return transmissionError; }

    public void authorize(UUID actorId, String actorName, Instant now) {
        if (status != PurchaseOrderStatus.DRAFT) throw new IllegalStateException("Only draft orders can be authorized");
        if (createdBy.equals(actorId)) throw new IllegalStateException("The order creator cannot approve their own order");
        status = PurchaseOrderStatus.AUTHORIZED;
        authorizedBy = actorId;
        authorizedByName = actorName;
        authorizedAt = now;
    }

    public void reject() {
        if (status != PurchaseOrderStatus.DRAFT) throw new IllegalStateException("Only draft orders can be rejected");
        status = PurchaseOrderStatus.REJECTED;
    }

    public void ensureTransmittable() {
        if (authorizedBy == null || authorizedAt == null ||
                (status != PurchaseOrderStatus.AUTHORIZED && status != PurchaseOrderStatus.TRANSMISSION_FAILED)) {
            throw new IllegalStateException("Facility-manager authorization is required before submission");
        }
    }

    public void submitted(String reference, Instant now) {
        ensureTransmittable();
        status = PurchaseOrderStatus.SUBMITTED;
        submittedAt = now;
        catalogueReference = reference;
        transmissionError = null;
    }

    public void transmissionFailed(String message) {
        ensureTransmittable();
        status = PurchaseOrderStatus.TRANSMISSION_FAILED;
        transmissionError = message == null ? "Gateway failure" : message.substring(0, Math.min(message.length(), 500));
    }

    protected PurchaseOrder() {
    }

    public PurchaseOrder(String poNumber, UUID facilityId, UUID supplierId, LocalDate expectedDelivery,
                         UUID createdBy, String createdByName, Instant createdAt) {
        this.poNumber = poNumber;
        this.facilityId = facilityId;
        this.supplierId = supplierId;
        this.expectedDelivery = expectedDelivery;
        this.createdBy = createdBy;
        this.createdByName = createdByName;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getPoNumber() {
        return poNumber;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public UUID getSupplierId() {
        return supplierId;
    }

    public LocalDate getExpectedDelivery() {
        return expectedDelivery;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
