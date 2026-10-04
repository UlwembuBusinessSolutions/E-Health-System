package co.ehealth.platform.pharmacy.dispensing;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class CollectionRulesTest {

    private final CollectionRules rules = new CollectionRules();

    private CollectCommand thirdParty(boolean idVerified, AuthorisationType authorisation, String proof) {
        var collector = new CollectCommand.Collector("Sipho Dlamini", "SA_ID", "8001015009087", "Brother", "0821234567",
                authorisation);
        return new CollectCommand(null, false, collector, idVerified, "sig-ref", proof, null);
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
                () -> rules.validate(thirdParty(false, AuthorisationType.WRITTEN, "proof-ref"), false));
    }

    @Test
    void thirdPartyWithoutCollectorDetailsIsRejected() {
        var command = new CollectCommand(null, false, null, true, null, null, null);

        assertThrows(DispensingValidationException.class, () -> rules.validate(command, false));
    }

    @Test
    void verbalConsentIsRejectedForScheduledMedicine() {
        DispensingValidationException thrown = assertThrows(DispensingValidationException.class,
                () -> rules.validate(thirdParty(true, AuthorisationType.VERBAL, "proof-ref"), true));

        assertTrue(thrown.getMessage().contains("Verbal consent"));
    }

    @Test
    void missingAuthorisationTypeIsRejectedForScheduledMedicine() {
        assertThrows(DispensingValidationException.class,
                () -> rules.validate(thirdParty(true, null, "proof-ref"), true));
    }

    @Test
    void writtenAuthorisationWithoutProofIsRejectedForScheduledMedicine() {
        assertThrows(DispensingValidationException.class,
                () -> rules.validate(thirdParty(true, AuthorisationType.WRITTEN, " "), true));
    }

    @Test
    void writtenAuthorisationWithProofAllowsScheduledMedicine() {
        assertDoesNotThrow(() -> rules.validate(thirdParty(true, AuthorisationType.WRITTEN, "proof-ref"), true));
    }
}
