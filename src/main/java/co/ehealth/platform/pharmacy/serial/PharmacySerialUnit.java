package co.ehealth.platform.pharmacy.serial;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

// One physical, serial-numbered unit (a glucometer, a BP monitor). The two
// entry ids tie the unit to the immutable ledger entries that brought it in
// and took it out, so the quantity on the ledger and the serials on the
// shelf can always be reconciled.
@Entity
@Table(name = "pharmacy_serial_units")
public class PharmacySerialUnit {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "batch_id")
    private UUID batchId;

    @Column(name = "serial_number", nullable = false, length = 100)
    private String serialNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SerialUnitStatus status;

    @Column(name = "received_entry_id", nullable = false)
    private UUID receivedEntryId;

    @Column(name = "removed_entry_id")
    private UUID removedEntryId;

    protected PharmacySerialUnit() {
    }

    public PharmacySerialUnit(UUID productId, UUID batchId, String serialNumber, UUID receivedEntryId) {
        this.productId = productId;
        this.batchId = batchId;
        this.serialNumber = serialNumber;
        this.status = SerialUnitStatus.IN_STOCK;
        this.receivedEntryId = receivedEntryId;
    }

    public void markRemoved(UUID removedEntryId) {
        this.status = SerialUnitStatus.REMOVED;
        this.removedEntryId = removedEntryId;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProductId() {
        return productId;
    }

    public UUID getBatchId() {
        return batchId;
    }

    public String getSerialNumber() {
        return serialNumber;
    }

    public SerialUnitStatus getStatus() {
        return status;
    }

    public UUID getReceivedEntryId() {
        return receivedEntryId;
    }

    public UUID getRemovedEntryId() {
        return removedEntryId;
    }
}
