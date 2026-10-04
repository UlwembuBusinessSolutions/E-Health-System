package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.Map;
import java.util.UUID;

// Stand-ins for the two seams another part of the pharmacy module fills in.
// Each backs off as soon as the integrator registers a real bean, so wiring
// the product schedule lookup and the Schedule register recorder is just
// "add a @Component implementing the interface" — nothing here to edit.
@Configuration
public class DispensingDefaultsConfig {

    // TEMPORARY DEFAULT: no product is ever treated as Schedule 5/6, so
    // dispensing writes no register entries and third-party collection never
    // demands written authorisation. Replace with a product-backed lookup.
    @Bean
    @ConditionalOnMissingBean(ProductScheduleLookup.class)
    ProductScheduleLookup unscheduledProductLookup() {
        return productIds -> Map.of();
    }

    // TEMPORARY DEFAULT: drops register entries. Replace with the real
    // append-only Schedule register recorder.
    @Bean
    @ConditionalOnMissingBean(ScheduleRegisterRecorder.class)
    ScheduleRegisterRecorder discardingScheduleRegisterRecorder() {
        return new ScheduleRegisterRecorder() {
            @Override
            public void recordDispense(UUID facilityId, UUID productId, String rxSerial, String patientName,
                                       String patientIdRef, String prescriberName, String prescriberRegNo,
                                       long quantity, String lotNumber, UUID dispensedBy,
                                       UUID ledgerTransactionId) {
                // intentionally empty — see class comment
            }

            @Override
            public void recordReturn(ReturnEntry entry) {
                // intentionally empty — see class comment
            }
        };
    }
}
