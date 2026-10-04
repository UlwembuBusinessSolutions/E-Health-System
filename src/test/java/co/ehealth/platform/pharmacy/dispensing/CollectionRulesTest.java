package co.ehealth.platform.pharmacy.dispensing;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CollectionRulesTest {

    private static final String PROOF_REF = "6f1d1f0e-3c1b-4e5a-9a39-0c8b5d7f2a11";

    private final CollectionRules rules = new CollectionRules();

    private CollectCommand thirdParty(boolean idVerified, AuthorisationType authorisation, String proof) {
        var collector = new CollectCommand.Collector("Sipho Dlamini", "SA_ID", "8001015009087", "Brother", "0821234567",
                authorisation);
        return new CollectCommand(null, false, collector, idVerified, null, proof, null, WitnessCredentials.NONE);
    }

    @Test
    void patientCollectingNeedsNoCollectorDetails() {
        assertDoesNotThrow(() -> rules.validate(CollectCommand.patientTakesAllPending(), true));
    }

    @Test
    void thirdPartyWithVerifiedIdMayCollectOrdinaryMedicine() {
        assertDoesNotThrow(() -> rules.validate(thirdParty(true, AuthorisationType.VERBAL, null), false));
    }

    @Test
    void thirdPartyMustHaveTheirIdVerified() {
        assertThrows(DispensingValidationException.class,
                () -> rules.validate(thirdParty(false, AuthorisationType.WRITTEN, PROOF_REF), false));
    }

    @Test
    void thirdPartyWithoutCollectorDetailsIsRejected() {
        var command = new CollectCommand(null, false, null, true, null, null, null, WitnessCredentials.NONE);

        assertThrows(DispensingValidationException.class, () -> rules.validate(command, false));
    }

    @Test
    void verbalConsentIsRejectedForScheduledMedicine() {
        DispensingValidationException thrown = assertThrows(DispensingValidationException.class,
                () -> rules.validate(thirdParty(true, AuthorisationType.VERBAL, PROOF_REF), true));

        assertTrue(thrown.getMessage().contains("Verbal consent"));
    }

    @Test
    void missingAuthorisationTypeIsRejectedForScheduledMedicine() {
        assertThrows(DispensingValidationException.class,
                () -> rules.validate(thirdParty(true, null, PROOF_REF), true));
    }

    @Test
    void writtenAuthorisationWithoutProofIsRejectedForScheduledMedicine() {
        assertThrows(DispensingValidationException.class,
                () -> rules.validate(thirdParty(true, AuthorisationType.WRITTEN, " "), true));
    }

    @Test
    void writtenAuthorisationWithProofAllowsScheduledMedicine() {
        assertDoesNotThrow(() -> rules.validate(thirdParty(true, AuthorisationType.WRITTEN, PROOF_REF), true));
    }
}
