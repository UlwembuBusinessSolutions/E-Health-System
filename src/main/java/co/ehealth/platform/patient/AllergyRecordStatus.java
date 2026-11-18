package co.ehealth.platform.patient;

// ACTIVE allergies are shown and enforced; INACTIVE ones (resolved, or entered in error) are kept for history only.
public enum AllergyRecordStatus {
    ACTIVE, INACTIVE
}