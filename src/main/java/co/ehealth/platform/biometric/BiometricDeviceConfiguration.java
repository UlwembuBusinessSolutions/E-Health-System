package co.ehealth.platform.biometric;

import co.ehealth.platform.biometric.adapter.UnavailableBiometricDeviceAdapter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Application-level biometric device wiring.
 *
 * Calling modules depend only on BiometricDeviceService/BiometricDevice.
 * Vendor-specific implementations can be introduced as adapters without
 * changing those calling modules.
 */
@Configuration
public class BiometricDeviceConfiguration {

    @Bean
    public UnavailableBiometricDeviceAdapter unavailableBiometricDeviceAdapter() {
        return new UnavailableBiometricDeviceAdapter();
    }

    @Bean(name = "biometricDevice")
    public BiometricDevice biometricDevice(
            UnavailableBiometricDeviceAdapter unavailableAdapter
    ) {
        return unavailableAdapter;
    }
}