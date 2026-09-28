package co.ehealth.platform.biometric;

import java.util.Objects;

/**
 * Vendor-neutral result returned from a biometric capture attempt.
 *
 * Vendor-specific result objects must never be exposed to callers.
 */
public record BiometricCaptureResult(
        BiometricCaptureStatus status,
        String deviceId,
        String sampleReference,
        String message
) {

    public BiometricCaptureResult {
        Objects.requireNonNull(status, "status must not be null");
    }

    public static BiometricCaptureResult captured(
            String deviceId,
            String sampleReference
    ) {
        return new BiometricCaptureResult(
                BiometricCaptureStatus.CAPTURED,
                deviceId,
                sampleReference,
                null
        );
    }

    public static BiometricCaptureResult unavailable(String message) {
        return new BiometricCaptureResult(
                BiometricCaptureStatus.UNAVAILABLE,
                null,
                null,
                message
        );
    }

    public static BiometricCaptureResult failed(String message) {
        return new BiometricCaptureResult(
                BiometricCaptureStatus.FAILED,
                null,
                null,
                message
        );
    }

    public boolean isCaptured() {
        return status == BiometricCaptureStatus.CAPTURED;
    }

    public boolean isUnavailable() {
        return status == BiometricCaptureStatus.UNAVAILABLE;
    }

    public boolean isFailed() {
        return status == BiometricCaptureStatus.FAILED;
    }
}