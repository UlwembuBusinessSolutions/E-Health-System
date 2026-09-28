package co.ehealth.platform.biometric;

/**
 * Biometric modalities supported by the Foundation abstraction.
 *
 * Hardware/vendor-specific terminology must be translated into
 * these application-level values by the adapter.
 */
public enum BiometricType {

    FINGERPRINT,

    FACE,

    IRIS
}