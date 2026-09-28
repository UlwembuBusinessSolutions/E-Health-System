package co.ehealth.platform.biometric;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.Objects;

/**
 * Application-facing biometric service.
 *
 * Calling modules depend on this service and the vendor-neutral
 * BiometricDevice abstraction. Vendor SDKs and APIs must never
 * cross into application modules.
 *
 * The currently configured device is selected through the
 * Spring "biometricDevice" bean. A future vendor adapter can
 * replace the unavailable adapter without changing callers.
 */
@Service
public class BiometricDeviceService {

    private final BiometricDevice biometricDevice;

    public BiometricDeviceService(
            @Qualifier("biometricDevice") BiometricDevice biometricDevice
    ) {
        this.biometricDevice = Objects.requireNonNull(
                biometricDevice,
                "biometricDevice must not be null"
        );
    }

    /**
     * Captures a biometric sample through the configured device.
     *
     * The caller receives only the vendor-neutral result contract.
     */
    public BiometricCaptureResult capture(
            BiometricCaptureRequest request
    ) {
        Objects.requireNonNull(request, "request must not be null");

        return biometricDevice.capture(request);
    }

    /**
     * Returns whether the configured biometric device is available.
     */
    public boolean isAvailable() {
        return biometricDevice.isAvailable();
    }

    /**
     * Returns the stable identifier of the configured device.
     */
    public String deviceId() {
        return biometricDevice.deviceId();
    }
}