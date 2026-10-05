package co.ehealth.platform.pharmacy.csvimport;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// One thing an import created: a product or a receipt. Undoing the import
// walks these rows.
@Entity
@Table(name = "pharmacy_import_batch_items")
public class ImportBatchItem {

    public enum Type {
        PRODUCT, RECEIPT
    }

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "batch_id", nullable = false)
    private UUID batchId;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_type", nullable = false, length = 10)
    private Type type;

    @Column(name = "ref_id", nullable = false)
    private UUID refId;

    protected ImportBatchItem() {
    }

    public ImportBatchItem(UUID batchId, Type type, UUID refId) {
        this.batchId = batchId;
        this.type = type;
        this.refId = refId;
    }

    public Type getType() {
        return type;
    }

    public UUID getRefId() {
        return refId;
    }
}
