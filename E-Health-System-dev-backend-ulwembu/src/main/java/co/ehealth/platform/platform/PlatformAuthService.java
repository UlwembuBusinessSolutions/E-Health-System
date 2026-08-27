package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.DummyHash;
import co.ehealth.platform.core.security.PlatformJwtService;
import co.ehealth.platform.identity.AccountLockedException;
import co.ehealth.platform.identity.InvalidCredentialsException;
import co.ehealth.platform.identity.DuplicateFieldException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

// Same lockout policy as identity.AuthService — rolling 1-hour failure
// window, 30-minute auto-clearing lockout, same DummyHash timing-safety
// pattern for the "no such operator" path. Reuses AccountLockedException/
// InvalidCredentialsException from identity/ rather than defining
// platform-specific equivalents — GlobalExceptionHandler already maps both
// to the right status codes, and neither class actually references
// anything tenant-specific. Unlike OrganizationProvisioningService,
// @Transactional is safe here — platform_operators lives entirely in the
// control schema, no tenant-context switching involved.
@Service
public class PlatformAuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration FAILURE_WINDOW = Duration.ofHours(1);
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(30);

    private final PlatformOperatorRepository platformOperatorRepository;
    private final PasswordEncoder passwordEncoder;
    private final PlatformJwtService platformJwtService;
    private final Clock clock;
    private final PlatformAuditLogRepository platformAuditLogRepository;

    public PlatformAuthService(PlatformOperatorRepository platformOperatorRepository,
                                PasswordEncoder passwordEncoder, PlatformJwtService platformJwtService,
                                Clock clock, PlatformAuditLogRepository platformAuditLogRepository) {
        this.platformOperatorRepository = platformOperatorRepository;
        this.passwordEncoder = passwordEncoder;
        this.platformJwtService = platformJwtService;
        this.clock = clock;
        this.platformAuditLogRepository = platformAuditLogRepository;
    }

    @Transactional
    public RegisteredOperator register(String firstName, String lastName, String email, String rawPassword) {
        if (platformOperatorRepository.existsByEmail(email)) {
            throw new DuplicateFieldException("email", "A platform operator with this email already exists.");
        }

        PlatformOperator operator = new PlatformOperator(
                email, firstName, lastName, passwordEncoder.encode(rawPassword));
        platformOperatorRepository.save(operator);
        platformAuditLogRepository.save(
                new PlatformAuditLog(operator.getId(), "PLATFORM_OPERATOR_REGISTERED", null, clock.instant()));

        PlatformJwtService.IssuedToken issued = platformJwtService.issue(operator.getId(), operator.getTokenVersion());
        return new RegisteredOperator(operator, issued);
    }

    // noRollbackFor is load-bearing — same reasoning as identity.AuthService.
    // login(): this method mutates the PlatformOperator entity to record a
    // failed attempt and then throws to signal the failure, and Spring's
    // default @Transactional rollback-on-unchecked-exception would
    // silently discard that bookkeeping on every failed attempt without it.
    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountLockedException.class})
    public PlatformJwtService.IssuedToken login(String email, String rawPassword) {
        Instant now = clock.instant();
        Optional<PlatformOperator> maybeOperator = platformOperatorRepository.findByEmail(email);
        maybeOperator.ifPresent(operator -> autoUnlockIfExpired(operator, now));

        if (maybeOperator.isPresent() && maybeOperator.get().getStatus() == PlatformOperatorStatus.LOCKED) {
            throw new AccountLockedException(remainingLockoutSeconds(maybeOperator.get(), now));
        }

        String hashToCheck = maybeOperator.map(PlatformOperator::getPasswordHash).orElse(DummyHash.VALUE);
        boolean passwordMatches = passwordEncoder.matches(rawPassword, hashToCheck);

        if (maybeOperator.isEmpty() || !passwordMatches
                || maybeOperator.get().getStatus() != PlatformOperatorStatus.ACTIVE) {
            maybeOperator.filter(operator -> operator.getStatus() != PlatformOperatorStatus.DISABLED)
                    .ifPresent(operator -> registerFailedAttempt(operator, now));
            throw new InvalidCredentialsException();
        }

        PlatformOperator operator = maybeOperator.get();
        // Every other platform-operator action (provisioning, suspend,
        // module toggles, operator creation) lands a platform_audit_log row
        // — signing in itself never did, the one gap PLATFORM_OPERATOR_LOGIN
        // below closes. detail follows this table's own established
        // "field: old -> new" convention (ORGANIZATION_DETAILS_UPDATED,
        // MODULE_TOGGLED), not a JSON blob — platform_audit_log.detail is a
        // plain VARCHAR(500), unlike the tenant-side audit_log's jsonb
        // before/after columns AuthService.login() writes to.
        String detail = "lastLoginAt: %s -> %s; failedLoginCount: %d -> 0"
                .formatted(operator.getLastLoginAt(), now, operator.getFailedLoginCount());
        operator.resetFailedAttempts();
        operator.setLastLoginAt(now);

        platformAuditLogRepository.save(
                new PlatformAuditLog(operator.getId(), "PLATFORM_OPERATOR_LOGIN", null, detail, now));

        return platformJwtService.issue(operator.getId(), operator.getTokenVersion());
    }

    private void autoUnlockIfExpired(PlatformOperator operator, Instant now) {
        if (operator.getStatus() == PlatformOperatorStatus.LOCKED
                && Duration.between(operator.getLockedAt(), now).compareTo(LOCKOUT_DURATION) >= 0) {
            operator.unlock();
        }
    }

    private long remainingLockoutSeconds(PlatformOperator operator, Instant now) {
        Duration elapsed = Duration.between(operator.getLockedAt(), now);
        return Math.max(0, LOCKOUT_DURATION.minus(elapsed).toSeconds());
    }

    private void registerFailedAttempt(PlatformOperator operator, Instant now) {
        boolean withinWindow = operator.getLastFailedLoginAt() != null
                && Duration.between(operator.getLastFailedLoginAt(), now).compareTo(FAILURE_WINDOW) <= 0;
        if (!withinWindow) {
            operator.resetFailedAttempts();
        }
        operator.incrementFailedAttempts();
        operator.setLastFailedLoginAt(now);
        if (operator.getFailedLoginCount() >= MAX_FAILED_ATTEMPTS) {
            operator.lock(now);
            // Same "crossing the threshold is the one transition worth its
            // own row" reasoning as identity.AuthService.registerFailedAttempt().
            platformAuditLogRepository.save(new PlatformAuditLog(operator.getId(), "ACCOUNT_LOCKED", null,
                    "failedLoginCount: " + operator.getFailedLoginCount(), now));
        }
    }

    public record RegisteredOperator(PlatformOperator operator, PlatformJwtService.IssuedToken token) {
    }
}
