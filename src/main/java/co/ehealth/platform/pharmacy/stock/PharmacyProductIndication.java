package co.ehealth.platform.pharmacy.stock;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

// One ICD-10 condition a medicine is prescribed for (e.g. amlodipine for I10). The prescriber's
// "Prescribing for" list reads these, which is how the story's "allow for medicines on the stated
// ICD-10 codes" works: the vitals point to a code, the code points to the medicines.
@Entity
@Table(name = "pharmacy_product_indications")
public class PharmacyProductIndication {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "icd10_code", nullable = false, length = 10)
    private String icd10Code;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected PharmacyProductIndication() {
    }

    public PharmacyProductIndication(UUID productId, String icd10Code) {
        this.productId = productId;
        this.icd10Code = icd10Code;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProductId() {
        return productId;
    }

    public String getIcd10Code() {
        return icd10Code;
    }
}
