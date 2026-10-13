package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.DummyHash;
import co.ehealth.platform.core.security.PatientJwtService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.AccountLockedException;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.InvalidCredentialsException;
import co.ehealth.platform.identity.InvalidResetCodeException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.security.SecureRandom;
import java.util.Optional;
import java.util.UUID;

// The patient portal's own auth service — same lockout policy as
// identity.AuthService/platform.PlatformAuthService (rolling 1-hour
// failure window, 30-minute auto-clearing lockout, DummyHash timing-safety
// for the "no such account" path), reusing AccountLockedException/
// InvalidCredentialsException from identity/ the same way
// PlatformAuthService already does rather than defining a third pair of
// equivalents.
@Service
public class PatientAuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration FAILURE_WINDOW = Duration.ofHours(1);
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(30);
    private static final Duration REGISTRATION_CODE_TTL = Duration.ofMinutes(10);
    private static final Duration REGISTRATION_RESEND_DELAY = Duration.ofSeconds(60);
    private static final Duration PASSWORD_RESET_CODE_TTL = Duration.ofMinutes(10);
    private static final Duration PASSWORD_RESET_RESEND_DELAY = Duration.ofSeconds(60);
    private static final int MAX_REGISTRATION_CODE_ATTEMPTS = 5;
    private static final int MAX_PASSWORD_RESET_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PatientAccountRepository patientAccountRepository;
    private final PatientRegistrationVerificationRepository verificationRepository;
    private final PatientPasswordResetTokenRepository resetTokenRepository;
    private final PatientRepository patientRepository;
    private final PatientService patientService;
    private final PasswordEncoder passwordEncoder;
    private final PatientJwtService patientJwtService;
    private final EmailService emailService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public PatientAuthService(PatientAccountRepository patientAccountRepository,
                               PatientRegistrationVerificationRepository verificationRepository,
                               PatientPasswordResetTokenRepository resetTokenRepository,
                               PatientRepository patientRepository, PatientService patientService,
                               PasswordEncoder passwordEncoder, PatientJwtService patientJwtService,
                               EmailService emailService, AuditLogService auditLogService, Clock clock) {
        this.patientAccountRepository = patientAccountRepository;
        this.verificationRepository = verificationRepository;
        this.resetTokenRepository = resetTokenRepository;
        this.patientRepository = patientRepository;
        this.patientService = patientService;
        this.passwordEncoder = passwordEncoder;
        this.patientJwtService = patientJwtService;
        this.emailService = emailService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    // This validates the SA ID and sends a code to the supplied email. MPI lookup and patient creation happen only after confirmation.
    @Transactional
    public RegistrationStarted register(RegisterAccountCommand cmd) {
        String normalizedEmail = normalizeEmail(cmd.email());
        SouthAfricanIdNumber.parse(cmd.idNumber());
        if (patientAccountRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new DuplicateFieldException("email", "An account with this email already exists.");
        }
        if (patientAccountRepository.findByIdNumber(cmd.idNumber()).isPresent()) {
            throw new DuplicateFieldException("idNumber", "An account for this ID number already exists.");
        }

        Instant now = clock.instant();
        Optional<PatientRegistrationVerification> pendingRegistration = verificationRepository
                .findTopByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(normalizedEmail);
        if (pendingRegistration.isPresent()
                && Duration.between(pendingRegistration.get().getCreatedAt(), now)
                .compareTo(REGISTRATION_RESEND_DELAY) < 0) {
            return new RegistrationStarted(normalizedEmail, REGISTRATION_CODE_TTL.toMinutes());
        }

        // Do not create a searchable patient record until the supplied email has been verified.
        verificationRepository.deleteByExpiresAtBefore(now);
        verificationRepository.deleteByEmailOrIdNumber(normalizedEmail, cmd.idNumber());
        // Derived delete methods load matching rows and defer their DELETE
        // until the persistence context flushes. Flush before inserting the
        // replacement so a retry cannot hit the unique email/ID constraint
        // while the previous pending registration is still in the database.
        verificationRepository.flush();
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        RegisterAccountCommand normalizedCommand = new RegisterAccountCommand(cmd.firstName(), cmd.lastName(),
                cmd.idNumber(), cmd.address(), cmd.contactNumber(), normalizedEmail, cmd.password());
        verificationRepository.saveAndFlush(new PatientRegistrationVerification(normalizedCommand,
                passwordEncoder.encode(cmd.password()), passwordEncoder.encode(code),
                now.plus(REGISTRATION_CODE_TTL), now));
        emailService.sendPatientRegistrationCodeEmail(normalizedEmail, cmd.firstName(), code,
                REGISTRATION_CODE_TTL.toMinutes());
        return new RegistrationStarted(normalizedEmail, REGISTRATION_CODE_TTL.toMinutes());
    }

    @Transactional(noRollbackFor = InvalidPatientVerificationCodeException.class)
    public RegistrationResult verifyRegistration(String email, String code) {
        Instant now = clock.instant();
        String normalizedEmail = normalizeEmail(email);
        Optional<PatientRegistrationVerification> maybePending = verificationRepository
                .findTopByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(normalizedEmail)
                .filter(pending -> !pending.isExpired(now)
                        && pending.getAttemptCount() < MAX_REGISTRATION_CODE_ATTEMPTS);
        String hashToCheck = maybePending.map(PatientRegistrationVerification::getCodeHash).orElse(DummyHash.VALUE);
        boolean matches = passwordEncoder.matches(code, hashToCheck);
        if (maybePending.isEmpty() || !matches) {
            maybePending.ifPresent(PatientRegistrationVerification::incrementAttempts);
            throw new InvalidPatientVerificationCodeException();
        }

        PatientRegistrationVerification pending = maybePending.get();
        Optional<Patient> existingPatient = patientRepository.findByIdNumber(pending.getIdNumber());
        if (existingPatient.isPresent() && (existingPatient.get().isArchived()
                || !matchesExistingPatientIdentity(pending, existingPatient.get()))) {
            throw new PatientIdentityMismatchException();
        }
        pending.markConsumed(now);
        UUID patientId = existingPatient
                .map(Patient::getId)
                .orElseGet(() -> patientService.registerSelf(new PatientService.RegisterPatientCommand(
                        pending.getFirstName(), pending.getLastName(), pending.getIdNumber(), pending.getAddress(),
                        pending.getContactNumber(), pending.getEmail(), null, null, null, null)).getId());
        PatientAccount account = new PatientAccount(pending.getIdNumber(), pending.getEmail(), pending.getFirstName(),
                pending.getLastName(), pending.getPasswordHash(), patientId, now);
        account = patientAccountRepository.save(account);
        verificationRepository.delete(pending);
        PatientJwtService.IssuedToken token = patientJwtService.issue(account.getId(),
                TenantContext.getCurrentTenant(), account.getTokenVersion());
        return new RegistrationResult(account, token);
    }

    private static boolean matchesExistingPatientIdentity(PatientRegistrationVerification pending, Patient patient) {
        SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse(pending.getIdNumber());
        return normalizeName(pending.getFirstName()).equals(normalizeName(patient.getFirstName()))
                && normalizeName(pending.getLastName()).equals(normalizeName(patient.getLastName()))
                && normalizeEmail(pending.getEmail()).equals(normalizeEmail(patient.getEmail()))
                && parsed.dateOfBirth().equals(patient.getDateOfBirth());
    }

    private static String normalizeName(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(java.util.Locale.ROOT);
    }

    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountLockedException.class})
    public PatientJwtService.IssuedToken login(String identifier, String rawPassword) {
        Instant now = clock.instant();
        Optional<PatientAccount> maybeAccount = findByLoginIdentifier(identifier);
        maybeAccount.ifPresent(account -> autoUnlockIfExpired(account, now));

        if (maybeAccount.isPresent() && maybeAccount.get().getStatus() == PatientAccountStatus.LOCKED) {
            throw new AccountLockedException(remainingLockoutSeconds(maybeAccount.get(), now));
        }

        String hashToCheck = maybeAccount.map(PatientAccount::getPasswordHash).orElse(DummyHash.VALUE);
        boolean passwordMatches = passwordEncoder.matches(rawPassword, hashToCheck);

        if (maybeAccount.isEmpty() || !passwordMatches
                || maybeAccount.get().getStatus() != PatientAccountStatus.ACTIVE) {
            maybeAccount.filter(account -> account.getStatus() != PatientAccountStatus.DISABLED)
                    .ifPresent(account -> registerFailedAttempt(account, now));
            throw new InvalidCredentialsException();
        }

        PatientAccount account = maybeAccount.get();
        account.resetFailedAttempts();
        account.setLastLoginAt(now);

        return patientJwtService.issue(account.getId(), TenantContext.getCurrentTenant(), account.getTokenVersion());
    }

    public PatientAccount accountForLogin(String identifier) {
        return findByLoginIdentifier(identifier).orElseThrow(InvalidCredentialsException::new);
    }

    @Transactional
    public void requestPasswordReset(String identifier, String requestIp) {
        Optional<PatientAccount> maybeAccount = findByLoginIdentifier(identifier);
        if (maybeAccount.isEmpty() || maybeAccount.get().getStatus() == PatientAccountStatus.DISABLED) return;

        PatientAccount account = maybeAccount.get();
        Instant now = clock.instant();
        Optional<PatientPasswordResetToken> current = resetTokenRepository
                .findTopByPatientAccountIdAndConsumedAtIsNullOrderByCreatedAtDesc(account.getId());
        if (current.isPresent() && !current.get().isExpired(now)
                && Duration.between(current.get().getCreatedAt(), now).compareTo(PASSWORD_RESET_RESEND_DELAY) < 0) {
            return;
        }

        resetTokenRepository.invalidateOutstanding(account.getId(), now);
        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        resetTokenRepository.saveAndFlush(new PatientPasswordResetToken(account.getId(),
                passwordEncoder.encode(code), now.plus(PASSWORD_RESET_CODE_TTL), requestIp, now));
        emailService.sendPasswordResetCodeEmail(account.getEmail(), account.getFirstName(), code,
                PASSWORD_RESET_CODE_TTL.toMinutes());
    }

    @Transactional(noRollbackFor = InvalidResetCodeException.class)
    public void confirmPasswordReset(String identifier, String code, String newPassword) {
        Optional<PatientAccount> maybeAccount = findByLoginIdentifier(identifier);
        Optional<PatientPasswordResetToken> maybeToken = maybeAccount
                .filter(account -> account.getStatus() != PatientAccountStatus.DISABLED)
                .flatMap(account -> resetTokenRepository
                        .findTopByPatientAccountIdAndConsumedAtIsNullOrderByCreatedAtDesc(account.getId()))
                .filter(token -> !token.isExpired(clock.instant())
                        && token.getAttemptCount() < MAX_PASSWORD_RESET_ATTEMPTS);
        String hashToCheck = maybeToken.map(PatientPasswordResetToken::getCodeHash).orElse(DummyHash.VALUE);
        boolean codeMatches = passwordEncoder.matches(code, hashToCheck);
        if (maybeAccount.isEmpty() || maybeToken.isEmpty() || !codeMatches) {
            maybeToken.ifPresent(PatientPasswordResetToken::incrementAttempts);
            throw new InvalidResetCodeException();
        }

        Instant now = clock.instant();
        maybeAccount.get().resetPassword(passwordEncoder.encode(newPassword));
        maybeToken.get().markConsumed(now);
        resetTokenRepository.invalidateOutstanding(maybeAccount.get().getId(), now);
        auditLogService.append(maybeAccount.get().getId(), null, "PATIENT_PASSWORD_RESET", "PatientAccount",
                maybeAccount.get().getId().toString(), null, null);
    }

    private Optional<PatientAccount> findByLoginIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) return Optional.empty();
        String normalized = identifier.trim();
        return normalized.contains("@")
                ? patientAccountRepository.findByEmailIgnoreCase(normalizeEmail(normalized))
                : patientAccountRepository.findByIdNumber(normalized);
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    // Nothing session-scoped to clear server-side today (no idle-lock
    // tracking for the patient portal yet, unlike staff's SessionActivityStore)
    // — logout is a no-op here and purely client-side (the frontend drops
    // the token). Kept as a real method, not inlined into the controller,
    // so a future server-side session concept has one obvious place to add
    // itself.
    public void logout() {
    }

    private void autoUnlockIfExpired(PatientAccount account, Instant now) {
        if (account.getStatus() == PatientAccountStatus.LOCKED
                && Duration.between(account.getLockedAt(), now).compareTo(LOCKOUT_DURATION) >= 0) {
            account.unlock();
        }
    }

    private long remainingLockoutSeconds(PatientAccount account, Instant now) {
        Duration elapsed = Duration.between(account.getLockedAt(), now);
        return Math.max(0, LOCKOUT_DURATION.minus(elapsed).toSeconds());
    }

    private void registerFailedAttempt(PatientAccount account, Instant now) {
        boolean withinWindow = account.getLastFailedLoginAt() != null
                && Duration.between(account.getLastFailedLoginAt(), now).compareTo(FAILURE_WINDOW) <= 0;
        if (!withinWindow) {
            account.resetFailedAttempts();
        }
        account.incrementFailedAttempts();
        account.setLastFailedLoginAt(now);
        if (account.getFailedLoginCount() >= MAX_FAILED_ATTEMPTS) {
            account.lock(now);
        }
    }

    public record RegisterAccountCommand(String firstName, String lastName, String idNumber, String address,
                                          String contactNumber, String email, String password) {
    }

    public record RegistrationStarted(String email, long expiresInMinutes) {
    }

    public record RegistrationResult(PatientAccount account, PatientJwtService.IssuedToken token) {
    }
}
