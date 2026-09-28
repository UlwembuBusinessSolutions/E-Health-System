package co.ehealth.platform.biometric;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class BiometricDeviceServiceTest {

    @Test
    void callerUsesAbstractionAndReceivesUnavailableResult() {
        BiometricDevice device = new BiometricDevice() {

            @Override
            public BiometricCaptureResult capture(
                    BiometricCaptureRequest request
            ) {
                return BiometricCaptureResult.unavailable(
                        "Test device unavailable"
                );
            }

            @Override
            public boolean isAvailable() {
                return false;
            }

            @Override
            public String deviceId() {
                return "test-device";
            }
        };

        BiometricDeviceService service =
                new BiometricDeviceService(device);

        BiometricCaptureResult result =
                service.capture(
                        new BiometricCaptureRequest(
                                UUID.randomUUID(),
                                BiometricType.FINGERPRINT
                        )
                );

        assertTrue(result.isUnavailable());
        assertEquals(
                "Test device unavailable",
                result.message()
        );
    }

    @Test
    void differentAdaptersCanBeSubstitutedWithoutChangingCaller() {
        BiometricDevice firstAdapter =
                new TestDevice("vendor-a");

        BiometricDevice secondAdapter =
                new TestDevice("vendor-b");

        assertNotNull(firstAdapter);
        assertNotNull(secondAdapter);

        BiometricDeviceService firstService =
                new BiometricDeviceService(firstAdapter);

        BiometricDeviceService secondService =
                new BiometricDeviceService(secondAdapter);

        BiometricCaptureRequest request =
                new BiometricCaptureRequest(
                        UUID.randomUUID(),
                        BiometricType.FINGERPRINT
                );

        assertEquals(
                "vendor-a",
                firstService.deviceId()
        );

        assertEquals(
                "vendor-b",
                secondService.deviceId()
        );

        assertTrue(
                firstService.capture(request).isCaptured()
        );

        assertTrue(
                secondService.capture(request).isCaptured()
        );
    }

    private static final class TestDevice
            implements BiometricDevice {

        private final String deviceId;

        private TestDevice(String deviceId) {
            this.deviceId = deviceId;
        }

        @Override
        public BiometricCaptureResult capture(
                BiometricCaptureRequest request
        ) {
            return BiometricCaptureResult.captured(
                    deviceId,
                    "sample-" + deviceId
            );
        }

        @Override
        public boolean isAvailable() {
            return true;
        }

        @Override
        public String deviceId() {
            return deviceId;
        }
    }
}