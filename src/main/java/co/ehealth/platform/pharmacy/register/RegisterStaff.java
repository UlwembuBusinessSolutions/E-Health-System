package co.ehealth.platform.pharmacy.register;

import java.util.UUID;

// A staff member as the register records them: the id plus the name at the
// time, so history survives renames and offboarding.
public record RegisterStaff(UUID id, String name) {
}
