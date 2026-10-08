package co.ehealth.platform.diagnosis;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

// One condition a clinician can record. The catalogue starts with common conditions and their ICD-10
// code; anything recorded that is not in it is added as CUSTOM (no code until one is assigned), so the
// same condition is always the same row and can be counted later.
@Entity
@Table(name = "diagnoses")
public class Diagnosis {

    public static final String SOURCE_ICD10 = "ICD10";
    public static final String SOURCE_CUSTOM = "CUSTOM";
    public static final int MAX_NAME_LENGTH = 200;

    @Id
    @GeneratedValue
    private UUID id;

    @Column(length = 30)
    private String code;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "name_key", nullable = false, length = 200)
    private String nameKey;

    @Column(nullable = false, length = 10)
    private String source;

    @Column(name = "catalogue_version", length = 30)
    private String catalogueVersion;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected Diagnosis() {
    }

    private Diagnosis(String name, UUID createdBy, Instant createdAt) {
        this.name = name;
        this.nameKey = keyOf(name);
        this.source = SOURCE_CUSTOM;
        this.active = true;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
    }

    /** A diagnosis a clinician typed that the catalogue did not have yet. */
    public static Diagnosis custom(String name, UUID createdBy, Instant createdAt) {
        return new Diagnosis(name.trim().replaceAll("\\s+", " "), createdBy, createdAt);
    }

    /** What two spellings of the same diagnosis have in common: lower case, single spaces. */
    public static String keyOf(String name) {
        return name == null ? "" : name.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    public UUID getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getSource() {
        return source;
    }

    public String getCatalogueVersion() {
        return catalogueVersion;
    }

    public boolean isActive() {
        return active;
    }
}
