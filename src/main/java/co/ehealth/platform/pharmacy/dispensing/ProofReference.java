package co.ehealth.platform.pharmacy.dispensing;

import java.util.UUID;

// The handle returned when a collection proof is uploaded. It is a random
// UUID and nothing else, so a reference can never carry a path or be guessed
// into another prescription's files.
final class ProofReference {

    private ProofReference() {
    }

    static String newReference() {
        return UUID.randomUUID().toString();
    }

    static String requireWellFormed(String reference) {
        try {
            return UUID.fromString(reference).toString();
        } catch (IllegalArgumentException | NullPointerException malformed) {
            throw new DispensingValidationException(
                    "That proof document could not be found. Upload the document again.");
        }
    }
}
