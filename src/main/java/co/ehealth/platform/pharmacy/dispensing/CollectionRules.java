package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

// Who may take medicine away, and what the pharmacist must have verified
// first. Checked before any stock moves, so a refused hand-over leaves
// nothing half-done. Pure rules — no repositories.
@Component
public class CollectionRules {

    public void validate(CollectCommand command, boolean containsScheduledMedicine) {
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
        if (!StringUtils.hasText(command.proof())) {
            throw new DispensingValidationException("Attach the patient's written authorisation before handing "
                    + "over Schedule 5/6 medicine.");
        }
    }
}
