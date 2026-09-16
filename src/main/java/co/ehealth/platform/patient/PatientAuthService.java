package co.ehealth.platform.patient;

import co.ehealth.platform.core.security.DummyHash;
import co.ehealth.platform.core.security.PatientJwtService;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.identity.AccountLockedException;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.InvalidCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
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

    private final PatientAccountRepository patientAccountRepository;
    private final PatientRepository patientRepository;
    private final PatientService patientService;
    private final PasswordEncoder passwordEncoder;
    private final PatientJwtService patientJwtService;
    private final Clock clock;

    public PatientAuthService(PatientAccountRepository patientAccountRepository, PatientRepository patientRepository,
                               PatientService patientService, PasswordEncoder passwordEncoder,
                               PatientJwtService patientJwtService, Clock clock) {
        this.patientAccountRepository = patientAccountRepository;
        this.patientRepository = patientRepository;
        this.patientService = patientService;
        this.passwordEncoder = passwordEncoder;
        this.patientJwtService = patientJwtService;
        this.clock = clock;
    }

    // The idNumber reconciliation the whole PatientAccount/Patient split
    // exists for: if reception already registered this person (a Patient
    // row with a matching idNumber exists), link to it instead of creating
    // a duplicate; otherwise create their Patient record now
    // (registerSelf()). Either way patientId is resolved before the
    // PatientAccount below is ever constructed — see PatientAccount's own
    // why-note on why patientId is never actually null in practice, and
    // PatientService.register()'s own why-note on what happens if reception
    // tries to register someone under an idNumber this method already
    // claimed (a normal DuplicateFieldException — correct, not a gap).
    // idNumber is validated the same way PatientService.register() does
    // (SouthAfricanIdNumber.parse() either returns or throws) before either
    // branch below runs, so a malformed ID number never reaches either
    // patientRepository.findByIdNumber() or patientService.registerSelf().
    @Transactional
    public RegistrationResult register(RegisterAccountCommand cmd) {
        SouthAfricanIdNumber.parse(cmd.idNumber());
        if (patientAccountRepository.existsByEmail(cmd.email())) {
            throw new DuplicateFieldException("email", "An account with this email already exists.");
        }
        if (patientAccountRepository.findByIdNumber(cmd.idNumber()).isPresent()) {
            throw new DuplicateFieldException("idNumber", "An account for this ID number already exists.");
        }

        UUID patientId = patientRepository.findByIdNumber(cmd.idNumber())
                .map(Patient::getId)
                // Reception has never seen this person — create their
                // clinical record now (registerSelf(), no staff principal
                // required) rather than leaving the account unlinked; the
                // person is registering themselves precisely because they
                // don't have one yet.
                .orElseGet(() -> patientService.registerSelf(new PatientService.RegisterPatientCommand(
                        cmd.firstName(), cmd.lastName(), cmd.idNumber(), cmd.address(), cmd.contactNumber(),
                        cmd.email(), null, null, null, null)).getId());

        PatientAccount account = new PatientAccount(cmd.idNumber(), cmd.email(), cmd.firstName(), cmd.lastName(),
                passwordEncoder.encode(cmd.password()), patientId, clock.instant());
        patientAccountRepository.save(account);

        // Signed in immediately on successful registration — this is a
        // self-service consumer signup, not a staff/admin creating an
        // account for someone else (StaffService/PlatformOperatorService's
        // own "hand over a temporary password, don't log them in" pattern
        // doesn't apply: there's no separate person to hand a password to).
        PatientJwtService.IssuedToken token =
                patientJwtService.issue(account.getId(), TenantContext.getCurrentTenant(), account.getTokenVersion());
        return new RegistrationResult(account, token);
    }

    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountLockedException.class})
    public PatientJwtService.IssuedToken login(String email, String rawPassword) {
        Instant now = clock.instant();
        Optional<PatientAccount> maybeAccount = patientAccountRepository.findByEmail(email);
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

    public record RegistrationResult(PatientAccount account, PatientJwtService.IssuedToken token) {
    }
}
