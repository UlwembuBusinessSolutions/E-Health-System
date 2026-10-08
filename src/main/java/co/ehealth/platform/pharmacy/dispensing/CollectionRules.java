package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

// Who may take medicine away, and what the pharmacist must have verified
// first. Checked before any stock moves, so a refused hand-over leaves
// nothing half-done. Pure rules — no repositories.
@Component
public class CollectionRules {

    static final String PNG_DATA_URL_PREFIX = "data:image/png;base64,";
    static final int MAX_SIGNATURE_CHARACTERS = 200_000;

    public void validate(CollectCommand command, boolean containsScheduledMedicine) {
        requireValidSignature(command.signature());
        if (StringUtils.hasText(command.proofRef())) {
            ProofReference.requireWellFormed(command.proofRef());
        }
        if (command.collectedByPatient()) {
            return;
        }
        CollectCommand.Collector collector = command.collector();
        if (collector == null || !hasCollectorDetails(collector)) {
            throw new DispensingValidationException("Enter the collector's name, ID type, ID number and "
                    + "relationship to the patient.");
        }
        if (!command.idVerified()) {
            throw new DispensingValidationException("Check the collector's ID document and confirm it before "
                    + "handing the medicine over.");
        }
        if (containsScheduledMedicine) {
            requireWrittenAuthorisation(command, collector);
        }
    }

    // The signature pad produces a small PNG data URL. Anything else, or
    // anything large, is refused rather than stored in the collection row.
    private void requireValidSignature(String signature) {
        if (!StringUtils.hasText(signature)) {
            return;
        }
        if (!signature.startsWith(PNG_DATA_URL_PREFIX)) {
            throw new DispensingValidationException("The signature must be a PNG image.");
        }
        if (signature.length() > MAX_SIGNATURE_CHARACTERS) {
            throw new DispensingValidationException("The signature image is too large. Clear it and sign again.");
        }
    }

    private boolean hasCollectorDetails(CollectCommand.Collector collector) {
        return StringUtils.hasText(collector.name()) && StringUtils.hasText(collector.idType())
                && StringUtils.hasText(collector.idNumber()) && StringUtils.hasText(collector.relationship());
    }

    // Schedule 5/6 medicine can be abused, so someone else collecting it
    // needs the patient's authorisation in writing, with the document on
    // file; a phone call or the collector's word is not enough.
    private void requireWrittenAuthorisation(CollectCommand command, CollectCommand.Collector collector) {
        if (collector.authorisationType() != AuthorisationType.WRITTEN) {
            throw new DispensingValidationException("Schedule 5/6 medicine can only be collected by someone else "
                    + "with the patient's written authorisation. Verbal consent is not enough.");
        }
        if (!StringUtils.hasText(command.proofRef())) {
            throw new DispensingValidationException("Attach the patient's written authorisation before handing "
                    + "over Schedule 5/6 medicine.");
        }
    }
}
