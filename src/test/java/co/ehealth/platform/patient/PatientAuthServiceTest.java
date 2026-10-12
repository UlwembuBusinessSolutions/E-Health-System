package co.ehealth.platform.patient;

import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.security.PatientJwtService;
import co.ehealth.platform.core.tenant.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PatientAuthServiceTest {
    private final PatientAccountRepository accounts = mock(PatientAccountRepository.class);
    private final PatientRegistrationVerificationRepository verifications =
            mock(PatientRegistrationVerificationRepository.class);
    private final PatientPasswordResetTokenRepository resetTokens = mock(PatientPasswordResetTokenRepository.class);
    private final PatientRepository patients = mock(PatientRepository.class);
    private final PatientService patientService = mock(PatientService.class);
    private final PasswordEncoder passwords = mock(PasswordEncoder.class);
    private final EmailService emails = mock(EmailService.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-08T08:00:00Z"), ZoneOffset.UTC);
    private final PatientJwtService jwt = new PatientJwtService(
            "a-test-only-patient-signing-secret-longer-than-32-bytes", 60, clock);
    private PatientAuthService service;

    @BeforeEach
    void setUp() {
        TenantContext.setCurrentTenant("test_clinic");
        service = new PatientAuthService(accounts, verifications, resetTokens, patients, patientService,
                passwords, jwt, emails, clock);
        when(accounts.existsByEmail("patient@example.com")).thenReturn(false);
        when(accounts.findByIdNumber("8001015009087")).thenReturn(Optional.empty());
        when(passwords.encode(anyString())).thenAnswer(call -> "hashed:" + call.getArgument(0));
    }

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void registrationSendsEmailCodeWithoutCreatingAnAccountOrPatientRecord() {
        PatientAuthService.RegistrationStarted result = service.register(command());

        assertEquals("patient@example.com", result.email());
        assertEquals(10, result.expiresInMinutes());
        verify(verifications).saveAndFlush(any(PatientRegistrationVerification.class));
        verify(emails).sendPatientRegistrationCodeEmail(eq("patient@example.com"), eq("Alex"),
                anyString(), eq(10L));
        verify(patients, never()).findByIdNumber(anyString());
        verify(patientService, never()).registerSelf(any());
        verify(accounts, never()).save(any(PatientAccount.class));
    }

    @Test
    void emailVerificationLinksAnExistingPatientAndCreatesTheAccount() {
        service.register(command());
        org.mockito.ArgumentCaptor<PatientRegistrationVerification> pendingCaptor =
                org.mockito.ArgumentCaptor.forClass(PatientRegistrationVerification.class);
        verify(verifications).saveAndFlush(pendingCaptor.capture());
        PatientRegistrationVerification pending = pendingCaptor.getValue();
        when(verifications.findTopByEmailAndConsumedAtIsNullOrderByCreatedAtDesc("patient@example.com"))
                .thenReturn(Optional.of(pending));
        when(passwords.matches(eq("123456"), anyString())).thenReturn(true);

        UUID existingPatientId = UUID.randomUUID();
        Patient existingPatient = mock(Patient.class);
        when(existingPatient.getId()).thenReturn(existingPatientId);
        when(existingPatient.getFirstName()).thenReturn("Alex");
        when(existingPatient.getLastName()).thenReturn("Patient");
        when(existingPatient.getDateOfBirth()).thenReturn(LocalDate.of(1980, 1, 1));
        when(patients.findByIdNumber("8001015009087")).thenReturn(Optional.of(existingPatient));
        UUID accountId = UUID.randomUUID();
        when(accounts.save(any(PatientAccount.class))).thenAnswer(call -> {
            PatientAccount account = call.getArgument(0);
            ReflectionTestUtils.setField(account, "id", accountId);
            return account;
        });

        PatientAuthService.RegistrationResult result =
                service.verifyRegistration("patient@example.com", "123456");

        assertEquals(existingPatientId, result.account().getPatientId());
        assertFalse(result.token().token().isBlank());
        verify(verifications).delete(pending);
        verify(patientService, never()).registerSelf(any());
    }

    @Test
    void verifiedRegistrationCreatesAndLinksANewPatientWhenNoMpiExists() {
        service.register(command());
        org.mockito.ArgumentCaptor<PatientRegistrationVerification> pendingCaptor =
                org.mockito.ArgumentCaptor.forClass(PatientRegistrationVerification.class);
        verify(verifications).saveAndFlush(pendingCaptor.capture());
        PatientRegistrationVerification pending = pendingCaptor.getValue();
        when(verifications.findTopByEmailAndConsumedAtIsNullOrderByCreatedAtDesc("patient@example.com"))
                .thenReturn(Optional.of(pending));
        when(passwords.matches(eq("123456"), anyString())).thenReturn(true);
        Patient createdPatient = mock(Patient.class);
        UUID patientId = UUID.randomUUID();
        when(createdPatient.getId()).thenReturn(patientId);
        when(patientService.registerSelf(any(PatientService.RegisterPatientCommand.class))).thenReturn(createdPatient);
        when(accounts.save(any(PatientAccount.class))).thenAnswer(call -> {
            PatientAccount account = call.getArgument(0);
            ReflectionTestUtils.setField(account, "id", UUID.randomUUID());
            return account;
        });

        PatientAuthService.RegistrationResult result = service.verifyRegistration("patient@example.com", "123456");

        assertEquals(patientId, result.account().getPatientId());
        verify(patients).findByIdNumber("8001015009087");
        verify(patientService).registerSelf(any(PatientService.RegisterPatientCommand.class));
    }

    @Test
    void invalidVerificationCodeIsRejectedAndAttemptIsRecorded() {
        service.register(command());
        org.mockito.ArgumentCaptor<PatientRegistrationVerification> pendingCaptor =
                org.mockito.ArgumentCaptor.forClass(PatientRegistrationVerification.class);
        verify(verifications).saveAndFlush(pendingCaptor.capture());
        PatientRegistrationVerification pending = pendingCaptor.getValue();
        when(verifications.findTopByEmailAndConsumedAtIsNullOrderByCreatedAtDesc("patient@example.com"))
                .thenReturn(Optional.of(pending));
        when(passwords.matches(eq("000000"), anyString())).thenReturn(false);

        assertThrows(InvalidPatientVerificationCodeException.class,
                () -> service.verifyRegistration("patient@example.com", "000000"));

        assertEquals(1, pending.getAttemptCount());
        verify(patientService, never()).registerSelf(any());
        verify(accounts, never()).save(any(PatientAccount.class));
    }

    @Test
    void expiredVerificationCodeCannotCreatePatientOrAccount() {
        service.register(command());
        org.mockito.ArgumentCaptor<PatientRegistrationVerification> pendingCaptor =
                org.mockito.ArgumentCaptor.forClass(PatientRegistrationVerification.class);
        verify(verifications).saveAndFlush(pendingCaptor.capture());
        PatientRegistrationVerification pending = pendingCaptor.getValue();
        ReflectionTestUtils.setField(pending, "expiresAt", clock.instant().minusSeconds(1));
        when(verifications.findTopByEmailAndConsumedAtIsNullOrderByCreatedAtDesc("patient@example.com"))
                .thenReturn(Optional.of(pending));
        when(passwords.matches(eq("123456"), anyString())).thenReturn(true);

        assertThrows(InvalidPatientVerificationCodeException.class,
                () -> service.verifyRegistration("patient@example.com", "123456"));
        verify(patientService, never()).registerSelf(any());
        verify(accounts, never()).save(any(PatientAccount.class));
    }

    @Test
    void existingPatientCannotBeLinkedWhenIdentityDetailsDoNotMatch() {
        service.register(command());
        org.mockito.ArgumentCaptor<PatientRegistrationVerification> pendingCaptor =
                org.mockito.ArgumentCaptor.forClass(PatientRegistrationVerification.class);
        verify(verifications).saveAndFlush(pendingCaptor.capture());
        PatientRegistrationVerification pending = pendingCaptor.getValue();
        when(verifications.findTopByEmailAndConsumedAtIsNullOrderByCreatedAtDesc("patient@example.com"))
                .thenReturn(Optional.of(pending));
        when(passwords.matches(eq("123456"), anyString())).thenReturn(true);
        Patient existingPatient = mock(Patient.class);
        when(existingPatient.getFirstName()).thenReturn("Different");
        when(existingPatient.getLastName()).thenReturn("Person");
        when(existingPatient.getDateOfBirth()).thenReturn(LocalDate.of(1980, 1, 1));
        when(patients.findByIdNumber("8001015009087")).thenReturn(Optional.of(existingPatient));

        assertThrows(PatientIdentityMismatchException.class,
                () -> service.verifyRegistration("patient@example.com", "123456"));
        verify(patientService, never()).registerSelf(any());
        verify(accounts, never()).save(any(PatientAccount.class));
    }

    @Test
    void retryRegistrationFlushesDeletionBeforeSavingReplacementCode() {
        service.register(command());
        service.register(command());

        verify(verifications, org.mockito.Mockito.times(2)).deleteByEmailOrIdNumber(
                "patient@example.com", "8001015009087");
        verify(verifications, org.mockito.Mockito.times(2)).flush();
        verify(verifications, org.mockito.Mockito.times(2)).saveAndFlush(any(PatientRegistrationVerification.class));
    }

    private static PatientAuthService.RegisterAccountCommand command() {
        return new PatientAuthService.RegisterAccountCommand("Alex", "Patient", "8001015009087",
                "1 Test Street", "+27821234567", "patient@example.com", "correct-horse-battery");
    }
}
