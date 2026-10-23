package co.ehealth.platform.pharmacy.dispensing;

import java.util.UUID;

// The second pharmacist a Schedule 6 hand-over names, and their account
// password typed at the counter to confirm they are really standing there.
public record WitnessCredentials(UUID staffId, String password) {

    public static final WitnessCredentials NONE = new WitnessCredentials(null, null);

    public boolean isComplete() {
        return staffId != null && password != null && !password.isBlank();
    }

    // A password must never reach a log line through an accidental toString().
    @Override
    public String toString() {
        return "WitnessCredentials[staffId=" + staffId + ", password=hidden]";
    }
}
