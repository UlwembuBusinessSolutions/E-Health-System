package co.ehealth.platform.pharmacy.integration;

import co.ehealth.platform.pharmacy.dispensing.WitnessConfirmation;
import co.ehealth.platform.pharmacy.dispensing.WitnessCredentials;
import co.ehealth.platform.pharmacy.register.WitnessVerifier;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Lets dispensing confirm a Schedule 6 witness with the register's own
// verifier, so the password check and the "must be a different person" rule
// cannot drift between the two.
@Component
class DispensingWitnessAdapter implements WitnessConfirmation {

    private final WitnessVerifier witnessVerifier;

    DispensingWitnessAdapter(WitnessVerifier witnessVerifier) {
        this.witnessVerifier = witnessVerifier;
    }

    @Override
    public UUID confirm(UUID actorUserId, WitnessCredentials credentials) {
        return witnessVerifier.verify(actorUserId, credentials.staffId(), credentials.password()).id();
    }
}
