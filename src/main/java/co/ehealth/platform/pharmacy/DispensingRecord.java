package co.ehealth.platform.pharmacy;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One row per dispensed prescription ITEM — prescriptionItemId is unique
// because once dispensed, an item is terminal and can never be dispensed a
// second time (PrescriptionItem's own why-note).
@Entity
@Table(name = "dispensing_records")
public class DispensingRecord {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_item_id", nullable = false, unique = true)
    private UUID prescriptionItemId;

    @Column(name = "dispensed_by_user_id", nullable = false)
    private UUID dispensedByUserId;

    @Column(name = "dispensed_at", nullable = false)
    private Instant dispensedAt;

    @Column(name = "collected_by_patient", nullable = false)
    private boolean collectedByPatient = true;
    @Column(name = "collector_name", length = 200) private String collectorName;
    @Column(name = "collector_id_type", length = 24) private String collectorIdType;
    @Column(name = "collector_id_number", length = 80) private String collectorIdNumber;
    @Column(name = "collector_relationship", length = 80) private String collectorRelationship;
    @Column(name = "collector_contact_number", length = 40) private String collectorContactNumber;
    @Column(name = "authorisation_type", length = 40) private String authorisationType;
    @Column(name = "proof_s3_key", length = 1024) private String proofS3Key;
    @Column(name = "signature_s3_key", length = 1024) private String signatureS3Key;
    @Column(name = "id_checked_by_user_id") private UUID idCheckedByUserId;
    @Column(name = "collection_notes", length = 2000) private String collectionNotes;

    protected DispensingRecord() {
    }

    public DispensingRecord(UUID prescriptionItemId, UUID dispensedByUserId, Instant dispensedAt) {
        this.prescriptionItemId = prescriptionItemId;
        this.dispensedByUserId = dispensedByUserId;
        this.dispensedAt = dispensedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionItemId() {
        return prescriptionItemId;
    }

    public UUID getDispensedByUserId() {
        return dispensedByUserId;
    }

    public Instant getDispensedAt() {
        return dispensedAt;
    }

    public boolean isCollectedByPatient() { return collectedByPatient; }
    public String getCollectorName() { return collectorName; }
    public String getCollectorIdType() { return collectorIdType; }
    public String getCollectorIdNumber() { return collectorIdNumber; }
    public String getCollectorRelationship() { return collectorRelationship; }
    public String getCollectorContactNumber() { return collectorContactNumber; }
    public String getAuthorisationType() { return authorisationType; }
    public String getProofS3Key() { return proofS3Key; }
    public String getSignatureS3Key() { return signatureS3Key; }
    public UUID getIdCheckedByUserId() { return idCheckedByUserId; }
    public String getCollectionNotes() { return collectionNotes; }

    public void recordThirdPartyCollection(String name, String idType, String idNumber, String relationship,
                                           String contact, String authorisation, String proofKey,
                                           String signatureKey, UUID checkedBy, String notes) {
        if (!collectedByPatient) throw new IllegalStateException("Collection records are immutable.");
        collectedByPatient = false;
        collectorName = name;
        collectorIdType = idType;
        collectorIdNumber = idNumber;
        collectorRelationship = relationship;
        collectorContactNumber = contact;
        authorisationType = authorisation;
        proofS3Key = proofKey;
        signatureS3Key = signatureKey;
        idCheckedByUserId = checkedBy;
        collectionNotes = notes;
    }
}
