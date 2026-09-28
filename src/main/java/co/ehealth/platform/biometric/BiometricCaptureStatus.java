package co.ehealth.platform.biometric;

/**
 * Outcome of a biometric capture request.
 *
 * The status is intentionally vendor-neutral so callers do not
 * need to understand hardware-specific exceptions or SDK states.
 */
public enum BiometricCaptureStatus {

    /**
     * A biometric sample was successfully captured.
     */
    CAPTURED,

    /**
     * No biometric device is currently available.
     *
     * Callers can use this status to invoke their configured
     * application fallback.
     */
    UNAVAILABLE,

    /**
     * A device is present but the requested capture could not
     * be completed.
     */
    FAILED
}