package co.ehealth.platform.pharmacy.dispensing;

import java.time.Instant;

// One hand-over as shown on the collection details screen. This is the only
// response that carries a third party's ID number in full, which is why
// opening it is written to the audit log. proofUrl is the path the browser
// fetches the proof document from; signatureDataUrl is the PNG data URL.
public record CollectionDetailsResponse(boolean collectedByPatient, String collectorName, String collectorIdType,
                                        String collectorIdNumber, String relationship, String phone,
                                        AuthorisationType authorisationType, String proofUrl,
                                        String signatureDataUrl, boolean idVerified, String notes,
                                        String handedOverByName, Instant handedOverAt) {
}
