package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.security.DummyHash;
import co.ehealth.platform.core.security.JwtService;
import co.ehealth.platform.core.security.SessionActivityStore;
import co.ehealth.platform.core.tenant.TenantContext;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration FAILURE_WINDOW = Duration.ofHours(1);
    private static final Duration LOCKOUT_DURATION = Duration.ofMinutes(30);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditLogService auditLogService;
    private final SessionActivityStore activityStore;
    private final Clock clock;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                        AuditLogService auditLogService, SessionActivityStore activityStore, Clock clock) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditLogService = auditLogService;
        this.activityStore = activityStore;
        this.clock = clock;
    }

    // noRollbackFor is load-bearing, not defensive polish: this method
    // records a failed attempt on the User entity (registerFailedAttempt())
    // and then throws InvalidCredentialsException/AccountLockedException to
    // signal the failure to the caller. Both are unchecked, and Spring's
    // default @Transactional behavior rolls back the whole transaction on
    // any unchecked exception — which would silently discard the very
    // bookkeeping this method just did, every single time, since the
    // exception that reports "login failed" is thrown from inside the same
    // transaction that recorded why. Without this, failedLoginCount never
    // advances past 0 and the lockout policy never engages.
    @Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountLockedException.class})
    public JwtService.IssuedToken login(String email, String rawPassword, String ipAddress) {
        Instant now = clock.instant();
        Optional<User> maybeUser = userRepository.findByEmail(email);
        maybeUser.ifPresent(user -> autoUnlockIfExpired(user, now));

        if (maybeUser.isPresent() && maybeUser.get().getStatus() == UserStatus.LOCKED) {
            // Still within LOCKOUT_DURATION — reject before touching BCrypt
            // at all. Running the password check here would let repeated
            // retries during the window keep extending the lockout, since
            // registerFailedAttempt below stamps a fresh lastFailedLoginAt
            // on every call.
            throw new AccountLockedException(remainingLockoutSeconds(maybeUser.get(), now));
        }

        String hashToCheck = maybeUser.map(User::getPasswordHash).orElse(DummyHash.VALUE);
        boolean passwordMatches = passwordEncoder.matches(rawPassword, hashToCheck);

        if (maybeUser.isEmpty() || !passwordMatches || maybeUser.get().getStatus() != UserStatus.ACTIVE) {
            // DISABLED is deliberately excluded from the counter: it's an
            // admin action, not something failed attempts should ever be
            // able to escalate past.
            maybeUser.filter(user -> user.getStatus() != UserStatus.DISABLED)
                    .ifPresent(user -> registerFailedAttempt(user, now));
            throw new InvalidCredentialsException();
        }

        User user = maybeUser.get();
        user.resetFailedAttempts();
        user.setLastLoginAt(now);

        List<String> roles = userRepository.findRoleNames(user.getId());
        JwtService.IssuedToken issued = jwtService.issue(
                user.getId(), TenantContext.getCurrentTenant(), roles, user.getTokenVersion());

        activityStore.recordActivity(issued.jti(), now);
        auditLogService.append(user.getId(), null, "LOGIN", "User", user.getId().toString(), null, null, ipAddress);

        return issued;
    }

    public void logout(String jti) {
        activityStore.clear(jti);
    }

    @Transactional
    public void unlock(UUID userId, String jti, String rawPassword) {
        User user = userRepository.findById(userId).orElseThrow(InvalidCredentialsException::new);
        if (!passwordEncoder.matches(rawPassword, user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }
        activityStore.recordActivity(jti, clock.instant());
    }

    private void autoUnlockIfExpired(User user, Instant now) {
        if (user.getStatus() == UserStatus.LOCKED
                && Duration.between(user.getLockedAt(), now).compareTo(LOCKOUT_DURATION) >= 0) {
            user.unlock();
        }
    }

    private long remainingLockoutSeconds(User user, Instant now) {
        Duration elapsed = Duration.between(user.getLockedAt(), now);
        return Math.max(0, LOCKOUT_DURATION.minus(elapsed).toSeconds());
    }

    // Failures roll off after FAILURE_WINDOW rather than accumulating
    // forever — a failed attempt from three days ago shouldn't count
    // toward locking the account today. Crossing MAX_FAILED_ATTEMPTS
    // within the window locks for LOCKOUT_DURATION; a successful login
    // above is the other path back to zero.
    private void registerFailedAttempt(User user, Instant now) {
        boolean withinWindow = user.getLastFailedLoginAt() != null
                && Duration.between(user.getLastFailedLoginAt(), now).compareTo(FAILURE_WINDOW) <= 0;
        if (!withinWindow) {
            user.resetFailedAttempts();
        }
        user.incrementFailedAttempts();
        user.setLastFailedLoginAt(now);
        if (user.getFailedLoginCount() >= MAX_FAILED_ATTEMPTS) {
            user.lock(now);
        }
    }
}
