package co.ehealth.platform.identity.mfa;

import org.springframework.stereotype.Component;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;

// RFC 6238 / RFC 4226. SHA-1, 6 digits, 30s: the combination every authenticator app supports.
@Component
public class TotpService {
    static final int PERIOD_SECONDS = 30;
    private static final int SKEW_STEPS = 1; // tolerate +/- one step of clock drift
    private static final char[] B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private final SecureRandom random = new SecureRandom();

    byte[] newSecret() {
        byte[] secret = new byte[20];
        random.nextBytes(secret);
        return secret;
    }

    String base32(byte[] data) {
        StringBuilder sb = new StringBuilder();
        int buffer = 0, bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                sb.append(B32[(buffer >> (bits - 5)) & 31]);
                bits -= 5;
            }
        }
        if (bits > 0)
            sb.append(B32[(buffer << (5 - bits)) & 31]);
        return sb.toString();
    }

    String code(byte[] secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret, "HmacSHA1"));
            byte[] h = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int o = h[h.length - 1] & 0x0f;
            int bin = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff);
            return "%06d".formatted(bin % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA1 unavailable", e);
        }
    }

    /**
     * The matching time step, or -1. Always checks every step so timing doesn't
     * reveal which matched.
     */
    long matchStep(byte[] secret, String submitted, Instant now) {
        if (submitted == null || !submitted.matches("\\d{6}"))
            return -1;
        long current = now.getEpochSecond() / PERIOD_SECONDS, matched = -1;
        for (long s = current - SKEW_STEPS; s <= current + SKEW_STEPS; s++) {
            if (MessageDigest.isEqual(code(secret, s).getBytes(StandardCharsets.UTF_8),
                    submitted.getBytes(StandardCharsets.UTF_8)))
                matched = s;
        }
        return matched;
    }

    String provisioningUri(String issuer, String account, String secretBase32) {
        return "otpauth://totp/" + enc(issuer) + ":" + enc(account) + "?secret=" + secretBase32
                + "&issuer=" + enc(issuer) + "&algorithm=SHA1&digits=6&period=" + PERIOD_SECONDS;
    }

    private static String enc(String v) {
        return URLEncoder.encode(v, StandardCharsets.UTF_8).replace("+", "%20");
    }
}