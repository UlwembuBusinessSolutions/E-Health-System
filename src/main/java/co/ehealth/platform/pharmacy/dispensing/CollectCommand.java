package co.ehealth.platform.pharmacy.dispensing;

import java.util.List;
import java.util.UUID;

// A hand-over request. itemIds null/empty means "every item still pending";
// naming items lets a pharmacist hand over only some of them (including an
// out-of-stock item whose stock has since arrived). collector is only read
// when collectedByPatient is false.
public record CollectCommand(List<UUID> itemIds, boolean collectedByPatient, Collector collector,
                             boolean idVerified, String signature, String proof, String notes) {

    public record Collector(String name, String idType, String idNumber, String relationship, String phone,
                            AuthorisationType authorisationType) {
    }

    // What the original "mark all as collected" button meant: the patient
    // took everything that is pending.
    public static CollectCommand patientTakesAllPending() {
        return new CollectCommand(null, true, null, false, null, null, null);
    }
}
