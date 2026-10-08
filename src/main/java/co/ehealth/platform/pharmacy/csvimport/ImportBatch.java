package co.ehealth.platform.pharmacy.csvimport;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// The record of one CSV import: who ran it, what it added, and whether it has
// since been undone. What it created is listed in ImportBatchItem.
@Entity
@Table(name = "pharmacy_import_batches")
public class ImportBatch {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "facility_id", nullable = false)
    private UUID facilityId;

    @Column(name = "file_name", length = 255)
    private String fileName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ImportBatchStatus status;

    @Column(name = "rows_imported", nullable = false)
    private int rowsImported;

    @Column(name = "products_created", nullable = false)
    private int productsCreated;

    @Column(name = "receipts_created", nullable = false)
    private int receiptsCreated;

    @Column(name = "units_received", nullable = false)
    private long unitsReceived;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_by_name", nullable = false, length = 200)
    private String createdByName;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "undone_at")
    private Instant undoneAt;

    @Column(name = "undone_by_name", length = 200)
    private String undoneByName;

    protected ImportBatch() {
    }

    public ImportBatch(UUID facilityId, String fileName, int rowsImported, int productsCreated, int receiptsCreated,
                       long unitsReceived, UUID createdBy, String createdByName, Instant createdAt) {
        this.facilityId = facilityId;
        this.fileName = fileName;
        this.status = ImportBatchStatus.ACTIVE;
        this.rowsImported = rowsImported;
        this.productsCreated = productsCreated;
        this.receiptsCreated = receiptsCreated;
        this.unitsReceived = unitsReceived;
        this.createdBy = createdBy;
        this.createdByName = createdByName;
        this.createdAt = createdAt;
    }

    public void markUndone(String undoneByName, Instant undoneAt) {
        this.status = ImportBatchStatus.UNDONE;
        this.undoneByName = undoneByName;
        this.undoneAt = undoneAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public String getFileName() {
        return fileName;
    }

    public ImportBatchStatus getStatus() {
        return status;
    }

    public int getRowsImported() {
        return rowsImported;
    }

    public int getProductsCreated() {
        return productsCreated;
    }

    public int getReceiptsCreated() {
        return receiptsCreated;
    }

    public long getUnitsReceived() {
        return unitsReceived;
    }

    public String getCreatedByName() {
        return createdByName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUndoneAt() {
        return undoneAt;
    }
}
