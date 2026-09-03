package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.security.TemporaryPasswordGenerator;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StaffServiceLicenseStatusTest {

    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-24T10:00:00Z"), ZoneOffset.UTC);

    @Test
    void rejects_missing_and_expired_prescribing_credentials() {
        User user = user();
        user.setHpcsaNumber("HPCSA-123");
        user.setHpcsaExpiryDate(LocalDate.of(2026, 8, 23));

        StaffService.LicenseStatus status = serviceFor(user).getLicenseStatus(UUID.randomUUID());

        assertThat(status.canPrescribe()).isFalse();
        assertThat(status.canDispense()).isFalse();
    }

    @Test
    void treats_a_registration_as_current_on_its_expiry_date() {
        User user = user();
        user.setSancNumber("SANC-123");
        user.setSancExpiryDate(LocalDate.of(2026, 8, 24));

        StaffService.LicenseStatus status = serviceFor(user).getLicenseStatus(UUID.randomUUID());

        assertThat(status.canPrescribe()).isTrue();
        assertThat(status.canDispense()).isFalse();
    }

    @Test
    void allows_dispensing_only_for_a_current_sapc_registration() {
        User user = user();
        user.setSapcNumber("SAPC-123");
        user.setSapcExpiryDate(LocalDate.of(2026, 12, 31));

        StaffService.LicenseStatus status = serviceFor(user).getLicenseStatus(UUID.randomUUID());

        assertThat(status.canPrescribe()).isFalse();
        assertThat(status.canDispense()).isTrue();
    }

    private StaffService serviceFor(User user) {
        UserRepository users = mock(UserRepository.class);
        when(users.findById(org.mockito.ArgumentMatchers.any())).thenReturn(java.util.Optional.of(user));
        return new StaffService(users, mock(RoleRepository.class), mock(UserComplianceDetailsRepository.class),
                mock(org.springframework.security.crypto.password.PasswordEncoder.class), mock(AuditLogService.class),
                mock(OrganizationRepository.class), mock(EmailService.class), mock(TemporaryPasswordGenerator.class), CLOCK);
    }

    private User user() {
        return new User("EMP-1", "staff@example.test", "Staff", "Member", "+27123456789", "hash",
                UUID.randomUUID(), Gender.OTHER);
    }
}
