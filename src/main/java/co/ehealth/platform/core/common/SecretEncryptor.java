package co.ehealth.platform.core.common;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

// AES-256-GCM — the one place in this codebase that encrypts a secret for
// storage rather than hashing it. BCrypt (SecurityConfig's
// BCryptPasswordEncoder) is one-way and right for login passwords, but a
// stored SMTP password (OrganizationMailSettings) has to come back out in
// plaintext to actually authenticate against a mail server, so it can't be
// hashed. Same "key lives in an env var, never committed" pattern as
// JWT_SECRET/PLATFORM_JWT_SECRET: app.security.secrets-key ->
// ORG_SECRETS_ENCRYPTION_KEY, with a dev-only default baked into
// application.yml the same way those two already are.
@Component
public class SecretEncryptor {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH_BITS = 128;
    private static final int GCM_IV_LENGTH_BYTES = 12;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public SecretEncryptor(@Value("${app.security.secrets-key}") String base64Key) {
        this.key = new SecretKeySpec(Base64.getDecoder().decode(base64Key), "AES");
    }

    // Output is base64(iv || ciphertext+tag). The IV is regenerated on
    // every call and doesn't need to stay secret, only unique-per-key —
    // prepending it in the clear is the standard GCM approach and means
    // decrypt() needs nothing else stored alongside the result.
    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] output = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, output, 0, iv.length);
            System.arraycopy(ciphertext, 0, output, iv.length, ciphertext.length);
            return Base64.getEncoder().encodeToString(output);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to encrypt secret", e);
        }
    }

    public String decrypt(String encoded) {
        try {
            byte[] input = Base64.getDecoder().decode(encoded);
            byte[] iv = new byte[GCM_IV_LENGTH_BYTES];
            System.arraycopy(input, 0, iv, 0, iv.length);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] plaintext = cipher.doFinal(input, iv.length, input.length - iv.length);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Failed to decrypt secret", e);
        }
    }
}
