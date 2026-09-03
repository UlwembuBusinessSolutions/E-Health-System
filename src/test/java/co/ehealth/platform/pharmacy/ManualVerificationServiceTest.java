package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class ManualVerificationServiceTest {

    @Test
    void routes_in_a_new_transaction_so_a_blocked_dispense_cannot_rollback_the_case() throws Exception {
        Method route = ManualVerificationService.class.getMethod("route", Prescription.class,
                java.util.UUID.class, String.class, java.time.Instant.class);

        Transactional transactional = route.getAnnotation(Transactional.class);

        assertThat(transactional).isNotNull();
        assertThat(transactional.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
    }
}
