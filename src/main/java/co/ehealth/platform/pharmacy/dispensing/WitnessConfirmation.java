package co.ehealth.platform.pharmacy.dispensing;

import java.util.UUID;

// Seam between dispensing and whoever can check a witness's identity. The
// real check lives with the Schedule register (its WitnessVerifier), so a
// hand-over and a manual register entry are witnessed by exactly the same
// rules; integration/DispensingWitnessAdapter connects the two.
public interface WitnessConfirmation {

    // Returns the staff id of the confirmed witness, or throws when the
    // witness is the actor themselves, unknown, inactive, or the password is
    // wrong.
    UUID confirm(UUID actorUserId, WitnessCredentials credentials);
}
