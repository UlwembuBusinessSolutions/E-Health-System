package co.ehealth.platform.biometric.adapter;

import co.ehealth.platform.biometric.BiometricCaptureRequest;
import co.ehealth.platform.biometric.BiometricCaptureResult;
import co.ehealth.platform.biometric.BiometricCaptureStatus;
import co.ehealth.platform.biometric.BiometricType;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class UnavailableBiometricDeviceAdapterTest {

    private final UnavailableBiometricDeviceAdapter adapter =
            new UnavailableBiometricDeviceAdapter();

    @Test
    void captureReturnsUnavailableWhenNoDeviceIsConnected() {
        BiometricCaptureRequest request =
                new BiometricCaptureRequest(
                        UUID.randomUUID(),
                        BiometricType.FINGERPRINT
                );

        BiometricCaptureResult result = adapter.capture(request);

        assertEquals(
                BiometricCaptureStatus.UNAVAILABLE,
                result.status()
        );

        assertTrue(result.isUnavailable());
        assertFalse(result.isCaptured());
        assertFalse(result.isFailed());

        assertEquals("none", adapter.deviceId());
        assertFalse(adapter.isAvailable());

        assertNotNull(result.message());
    }
}