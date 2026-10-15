package co.ehealth.platform.core.security;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

// One generator, not three — this exact 16-char/excludes-ambiguous-characters
// scheme used to be copy-pasted separately into OrganizationProvisioningService
// and PlatformOperatorService (both platform-operator-driven account
// creation); StaffService's admin-triggered password reset is the third
// caller that made keeping three copies in sync no longer reasonable.
// Excludes I/O/0/1/l — characters easy to misread when a temporary password
// is read aloud or copied off a screen, not a security requirement.
@Component
public class TemporaryPasswordGenerator {

    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final int LENGTH = 16;
    private static final SecureRandom RANDOM = new SecureRandom();

    public String generate() {
        StringBuilder password = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            password.append(CHARS.charAt(RANDOM.nextInt(CHARS.length())));
        }
        return password.toString();
    }
}
