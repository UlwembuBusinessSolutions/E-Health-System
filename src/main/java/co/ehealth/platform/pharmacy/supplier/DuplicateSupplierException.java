package co.ehealth.platform.pharmacy.supplier;

import java.util.UUID;

// similar = false: the name normalises to an existing supplier's name, so it
// is blocked outright. similar = true: only a near match, which the client
// may override with confirmDistinct once the user says it really is a
// different company.
public class DuplicateSupplierException extends RuntimeException {

    private final UUID existingId;
    private final String existingName;
    private final boolean similar;

    public DuplicateSupplierException(UUID existingId, String existingName, boolean similar) {
        super(similar
                ? "A supplier with a very similar name already exists: \"" + existingName
                        + "\". If this is a different company, confirm it to continue."
                : "A supplier called \"" + existingName + "\" already exists. Use that one instead.");
        this.existingId = existingId;
        this.existingName = existingName;
        this.similar = similar;
    }

    public UUID getExistingId() {
        return existingId;
    }

    public String getExistingName() {
        return existingName;
    }

    public boolean isSimilar() {
        return similar;
    }
}
