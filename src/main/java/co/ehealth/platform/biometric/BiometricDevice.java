package co.ehealth.platform.biometric;

/**
 * Vendor-neutral abstraction for biometric hardware.
 *
 * Application modules depend on this interface only.
 * Vendor SDKs and APIs must remain behind adapter implementations.
 */
public interface BiometricDevice {

    /**
     * Captures a biometric sample using the configured device.
     *
     * @param request vendor-neutral capture request
     * @return vendor-neutral capture result
     */
    BiometricCaptureResult capture(BiometricCaptureRequest request);

    /**
     * Returns whether this device is currently available.
     */
    boolean isAvailable();

    /**
     * Returns the stable identifier of the device when available.
     */
    String deviceId();
}