package co.ehealth.platform.pharmacy.register;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One line of the scheduled medicines register. Append-only: there are no
// setters, the repository can only save and read, and a database trigger
// rejects UPDATE/DELETE. A mistake is corrected by a further entry, never
// by editing history.
@Entity
@Table(name = "pharmacy_schedule_register_entries")
public class ScheduleRegisterEntry {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, insertable = false, updatable = false)
    private long seq;

    @Column(name = "facility_id", nullable = false, updatable = false)
    private UUID facilityId;

    @Column(name = "product_id", nullable = false, updatable = false)
    private UUID productId;

    @Column(name = "entry_at", nullable = false, updatable = false)
    private Instant entryAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 10)
    private RegisterEntryKind kind;

    @Column(name = "rx_serial", updatable = false, length = 50)
    private String rxSerial;

    @Column(name = "patient_name", updatable = false, length = 200)
    private String patientName;

    @Column(name = "patient_id_ref", updatable = false, length = 100)
    private String patientIdRef;

    @Column(name = "prescriber_name", updatable = false, length = 200)
    private String prescriberName;

    @Column(name = "prescriber_reg_no", updatable = false, length = 50)
    private String prescriberRegNo;

    @Column(name = "quantity_in", nullable = false, updatable = false)
    private long quantityIn;

    @Column(name = "quantity_out", nullable = false, updatable = false)
    private long quantityOut;

    @Column(name = "balance_after", nullable = false, updatable = false)
    private long balanceAfter;

    @Column(name = "lot_number", nullable = false, updatable = false, length = 100)
    private String lotNumber;

    @Column(name = "dispensed_by", nullable = false, updatable = false)
    private UUID dispensedBy;

    @Column(name = "dispensed_by_name", nullable = false, updatable = false, length = 200)
    private String dispensedByName;

    @Column(name = "witnessed_by", updatable = false)
    private UUID witnessedBy;

    @Column(name = "witnessed_by_name", updatable = false, length = 200)
    private String witnessedByName;

    @Column(updatable = false, length = 200)
    private String reason;

    @Column(name = "ledger_transaction_id", updatable = false)
    private UUID ledgerTransactionId;

    protected ScheduleRegisterEntry() {
    }

    ScheduleRegisterEntry(RegisterEntryDetails details, long balanceAfter, Instant entryAt) {
        this.facilityId = details.facilityId();
        this.productId = details.productId();
        this.entryAt = entryAt;
        this.kind = details.kind();
        this.rxSerial = details.rxSerial();
        this.patientName = details.patientName();
        this.patientIdRef = details.patientIdRef();
        this.prescriberName = details.prescriberName();
        this.prescriberRegNo = details.prescriberRegNo();
        this.quantityIn = details.kind().isIncoming() ? details.quantity() : 0;
        this.quantityOut = details.kind().isIncoming() ? 0 : details.quantity();
        this.balanceAfter = balanceAfter;
        this.lotNumber = details.lotNumber();
        this.dispensedBy = details.actor().id();
        this.dispensedByName = details.actor().name();
        this.witnessedBy = details.witness() == null ? null : details.witness().id();
        this.witnessedByName = details.witness() == null ? null : details.witness().name();
        this.ledgerTransactionId = details.ledgerTransactionId();
        this.reason = details.reason();
    }

    public UUID getId() {
        return id;
    }

    public UUID getFacilityId() {
        return facilityId;
    }

    public UUID getProductId() {
        return productId;
    }

    public Instant getEntryAt() {
        return entryAt;
    }

    public RegisterEntryKind getKind() {
        return kind;
    }

    public String getRxSerial() {
        return rxSerial;
    }

    public String getPatientName() {
        return patientName;
    }

    public String getPatientIdRef() {
        return patientIdRef;
    }

    public String getPrescriberName() {
        return prescriberName;
    }

    public String getPrescriberRegNo() {
        return prescriberRegNo;
    }

    public long getQuantityIn() {
        return quantityIn;
    }

    public long getQuantityOut() {
        return quantityOut;
    }

    public long getBalanceAfter() {
        return balanceAfter;
    }

    public String getLotNumber() {
        return lotNumber;
    }

    public UUID getDispensedBy() {
        return dispensedBy;
    }

    public String getDispensedByName() {
        return dispensedByName;
    }

    public UUID getWitnessedBy() {
        return witnessedBy;
    }

    public String getWitnessedByName() {
        return witnessedByName;
    }

    public String getReason() {
        return reason;
    }

    public UUID getLedgerTransactionId() {
        return ledgerTransactionId;
    }
}
