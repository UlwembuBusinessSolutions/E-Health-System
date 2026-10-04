package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.identity.UserStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.UUID;

// Confirms a Schedule 6 witness. The identity module has no PIN concept, so
// the witness's PIN is their own account password, typed at the moment of
// witnessing and checked with the same password encoder as login. It must be
// a second person: the actor cannot witness themselves.
@Component
class WitnessVerifier {

    // One message for "no such staff member" and "wrong password" so the
    // endpoint cannot be used to discover which staff ids exist.
    private static final String CONFIRMATION_FAILED =
            "The witness could not be confirmed. Check the staff member and password.";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    WitnessVerifier(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    RegisterStaff verify(UUID actorUserId, UUID witnessStaffId, String witnessPin) {
        if (witnessStaffId == null || witnessPin == null || witnessPin.isBlank()) {
            throw new InvalidWitnessException(
                    "Schedule 6 medicines need a witness. Choose the witness and have them enter their password.");
        }
        if (witnessStaffId.equals(actorUserId)) {
            throw new InvalidWitnessException("The witness must be a different staff member from you.");
        }
        User witness = userRepository.findById(witnessStaffId)
                .filter(user -> user.getStatus() == UserStatus.ACTIVE)
                .filter(user -> passwordEncoder.matches(witnessPin, user.getPasswordHash()))
                .orElseThrow(() -> new InvalidWitnessException(CONFIRMATION_FAILED));
        return new RegisterStaff(witness.getId(), witness.getFirstName() + " " + witness.getLastName());
    }
}
