package co.ehealth.platform.biometric;

import co.ehealth.platform.biometric.adapter.UnavailableBiometricDeviceAdapter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(
        classes = BiometricDeviceSpringWiringTest.TestConfiguration.class,
        properties = "app.biometric.provider=unavailable"
)
class BiometricDeviceSpringWiringTest {

    @Autowired
    private ApplicationContext applicationContext;

    @Autowired
    private BiometricDeviceService biometricDeviceService;

    @Test
    void applicationUsesBiometricDeviceAbstraction() {
        BiometricDevice device =
                applicationContext.getBean("biometricDevice", BiometricDevice.class);

        assertNotNull(device);
        assertInstanceOf(
                UnavailableBiometricDeviceAdapter.class,
                device
        );

        assertFalse(biometricDeviceService.isAvailable());
        assertEquals(
                "none",
                biometricDeviceService.deviceId()
        );
    }

    @Test
    void unavailableDeviceProducesExplicitFallbackOutcome() {
        BiometricCaptureResult result =
                biometricDeviceService.capture(
                        new BiometricCaptureRequest(
                                UUID.randomUUID(),
                                BiometricType.FINGERPRINT
                        )
                );

        assertEquals(
                BiometricCaptureStatus.UNAVAILABLE,
                result.status()
        );

        assertTrue(result.isUnavailable());
        assertFalse(result.isCaptured());
        assertFalse(result.isFailed());

        assertNotNull(result.message());
        assertEquals(
                "No biometric device is currently available",
                result.message()
        );
    }

    @Test
    void serviceDependsOnVendorNeutralDeviceContract() {
        assertNotNull(
                applicationContext.getBean(
                        BiometricDeviceService.class
                )
        );

        assertNotNull(
                applicationContext.getBean(
                        "biometricDevice",
                        BiometricDevice.class
                )
        );
    }

    @org.springframework.context.annotation.Configuration
    @Import({
            BiometricDeviceConfiguration.class,
            BiometricDeviceService.class
    })
    static class TestConfiguration {
    }
}
