package co.ehealth.platform.biometric;

import java.util.Objects;
import java.util.UUID;

/**
 * Vendor-neutral request for a biometric capture.
 *
 * This object deliberately contains application-level information
 * only. Vendor SDK request objects must never cross this boundary.
 */
public record BiometricCaptureRequest(
        UUID subjectId,
        BiometricType biometricType
) {

    public BiometricCaptureRequest {
        Objects.requireNonNull(subjectId, "subjectId must not be null");
        Objects.requireNonNull(biometricType, "biometricType must not be null");
    }
}