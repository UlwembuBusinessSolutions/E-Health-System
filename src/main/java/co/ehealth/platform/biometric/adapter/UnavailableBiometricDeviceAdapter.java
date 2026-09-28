package co.ehealth.platform.biometric.adapter;

import co.ehealth.platform.biometric.BiometricCaptureRequest;
import co.ehealth.platform.biometric.BiometricCaptureResult;
import co.ehealth.platform.biometric.BiometricDevice;

/**
 * Default adapter used when no physical biometric device is connected.
 *
 * This keeps vendor/device concerns behind the BiometricDevice abstraction.
 * A real vendor adapter can replace this bean without changing calling modules.
 */
public class UnavailableBiometricDeviceAdapter implements BiometricDevice {

    @Override
    public BiometricCaptureResult capture(BiometricCaptureRequest request) {
        return BiometricCaptureResult.unavailable(
                "No biometric device is currently available"
        );
    }

    @Override
    public boolean isAvailable() {
        return false;
    }

    @Override
    public String deviceId() {
        return "none";
    }
}