package co.ehealth.platform.pharmacy.supplier;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// A company the pharmacy buys stock from. Never deleted: receipts reference
// it, so a supplier that is no longer used is archived, and one that turned
// out to be a duplicate is merged into the real one (mergedIntoId keeps that
// trail).
@Entity
@Table(name = "pharmacy_suppliers")
public class PharmacySupplier {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "name_key", nullable = false, length = 200)
    private String nameKey;

    @Column(length = 50)
    private String phone;

    @Column(length = 200)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SupplierStatus status;

    @Column(name = "merged_into_id")
    private UUID mergedIntoId;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    protected PharmacySupplier() {
    }

    public PharmacySupplier(String name, String phone, String email, UUID createdBy, Instant createdAt) {
        this.name = name;
        this.nameKey = SupplierNameKey.of(name);
        this.phone = phone;
        this.email = email;
        this.status = SupplierStatus.ACTIVE;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    public void updateDetails(String name, String phone, String email, Instant updatedAt) {
        this.name = name;
        this.nameKey = SupplierNameKey.of(name);
        this.phone = phone;
        this.email = email;
        this.updatedAt = updatedAt;
    }

    public void archive(Instant updatedAt) {
        this.status = SupplierStatus.ARCHIVED;
        this.updatedAt = updatedAt;
    }

    public void reactivate(Instant updatedAt) {
        this.status = SupplierStatus.ACTIVE;
        this.updatedAt = updatedAt;
    }

    public void archiveAsMergedInto(UUID targetSupplierId, Instant updatedAt) {
        archive(updatedAt);
        this.mergedIntoId = targetSupplierId;
    }

    public boolean isActive() {
        return status == SupplierStatus.ACTIVE;
    }

    public boolean wasMerged() {
        return mergedIntoId != null;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getNameKey() {
        return nameKey;
    }

    public String getPhone() {
        return phone;
    }

    public String getEmail() {
        return email;
    }

    public SupplierStatus getStatus() {
        return status;
    }

    public UUID getMergedIntoId() {
        return mergedIntoId;
    }

    public UUID getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
