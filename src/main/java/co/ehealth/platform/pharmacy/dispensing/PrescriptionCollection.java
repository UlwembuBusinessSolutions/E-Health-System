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

// One hand-over event: who physically took the medicine and how the
// pharmacist satisfied themselves they were allowed to. signatureDataUrl is the
// collector's signature as a PNG data URL; proofDocumentRef is the reference
// to the authorisation scan kept in CollectionProofStorage.
@Entity
@Table(name = "prescription_collections")
public class PrescriptionCollection {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "prescription_id", nullable = false, updatable = false)
    private UUID prescriptionId;

    @Column(name = "collected_by_patient", nullable = false, updatable = false)
    private boolean collectedByPatient;

    @Column(name = "collector_name", updatable = false, length = 200)
    private String collectorName;

    @Column(name = "collector_id_type", updatable = false, length = 30)
    private String collectorIdType;

    @Column(name = "collector_id_number", updatable = false, length = 50)
    private String collectorIdNumber;

    @Column(updatable = false, length = 100)
    private String relationship;

    @Column(updatable = false, length = 30)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(name = "authorisation_type", updatable = false, length = 10)
    private AuthorisationType authorisationType;

    @Column(name = "proof_document_ref", updatable = false, length = 500)
    private String proofDocumentRef;

    @Column(name = "signature_data_url", updatable = false, columnDefinition = "TEXT")
    private String signatureDataUrl;

    @Column(name = "id_verified", nullable = false, updatable = false)
    private boolean idVerified;

    @Column(updatable = false, length = 500)
    private String notes;

    @Column(name = "handed_over_by", nullable = false, updatable = false)
    private UUID handedOverBy;

    @Column(name = "handed_over_at", nullable = false, updatable = false)
    private Instant handedOverAt;

    protected PrescriptionCollection() {
    }

    PrescriptionCollection(UUID prescriptionId, CollectCommand command, UUID handedOverBy, Instant handedOverAt) {
        this.prescriptionId = prescriptionId;
        this.collectedByPatient = command.collectedByPatient();
        this.idVerified = command.idVerified();
        this.signatureDataUrl = command.signature();
        this.proofDocumentRef = command.proofRef();
        this.notes = command.notes();
        this.handedOverBy = handedOverBy;
        this.handedOverAt = handedOverAt;
        if (!command.collectedByPatient()) {
            CollectCommand.Collector collector = command.collector();
            this.collectorName = collector.name();
            this.collectorIdType = collector.idType();
            this.collectorIdNumber = collector.idNumber();
            this.relationship = collector.relationship();
            this.phone = collector.phone();
            this.authorisationType = collector.authorisationType();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getPrescriptionId() {
        return prescriptionId;
    }

    public boolean isCollectedByPatient() {
        return collectedByPatient;
    }

    public String getCollectorName() {
        return collectorName;
    }

    public String getCollectorIdType() {
        return collectorIdType;
    }

    public String getCollectorIdNumber() {
        return collectorIdNumber;
    }

    public String getRelationship() {
        return relationship;
    }

    public String getPhone() {
        return phone;
    }

    public AuthorisationType getAuthorisationType() {
        return authorisationType;
    }

    public String getProofDocumentRef() {
        return proofDocumentRef;
    }

    public String getSignatureDataUrl() {
        return signatureDataUrl;
    }

    public boolean isIdVerified() {
        return idVerified;
    }

    public String getNotes() {
        return notes;
    }

    public UUID getHandedOverBy() {
        return handedOverBy;
    }

    public Instant getHandedOverAt() {
        return handedOverAt;
    }
}
