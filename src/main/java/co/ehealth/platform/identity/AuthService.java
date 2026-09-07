package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.security.DummyHash;
import co.ehealth.platform.core.security.JwtService;
import co.ehealth.platform.core.security.SessionActivityStore;
import co.ehealth.platform.core.tenant.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
    private final ObjectMapper objectMapper;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                        AuditLogService auditLogService, SessionActivityStore activityStore, Clock clock,
                        ObjectMapper objectMapper) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditLogService = auditLogService;
        this.activityStore = activityStore;
        this.clock = clock;
        this.objectMapper = objectMapper;
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
    public JwtService.IssuedToken login(String email, String rawPassword) {
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
        // Captured before either field changes below — lastLoginAt shows
        // login history continuity (when this person was last here, not
        // just that they're here now), and a nonzero failedLoginCount going
        // to zero is itself a meaningful signal (this login followed one or
        // more failed attempts, within FAILURE_WINDOW). Every other
        // auditLogService.append() call site in this codebase still passes
        // null for both — LOGIN is the first action where the state that
        // actually changes is worth recording rather than just the fact
        // that the action happened. ipAddress/device are no longer passed
        // explicitly — append() derives both itself from the current
        // request via RequestMetadata.
        String beforeValue = serializeLoginState(user.getFailedLoginCount(), user.getLastLoginAt());

        user.resetFailedAttempts();
        user.setLastLoginAt(now);

        List<String> roles = userRepository.findRoleNames(user.getId());
        JwtService.IssuedToken issued = jwtService.issue(
                user.getId(), TenantContext.getCurrentTenant(), roles, user.getTokenVersion());

        activityStore.recordActivity(issued.jti(), now);
        String afterValue = serializeLoginState(user.getFailedLoginCount(), user.getLastLoginAt());
        auditLogService.append(user.getId(), null, "LOGIN", "User", user.getId().toString(),
                beforeValue, afterValue);

        return issued;
    }

    // AuditLog.beforeValue/afterValue are a raw JSON column (jsonb) — the
    // caller supplies already-serialized text, nothing downstream converts
    // a POJO for it. Swallows serialization failure the same way
    // EmailService swallows a failed send: a malformed audit detail
    // shouldn't be able to fail a successful login, and a two-field record
    // has no real way to fail here anyway.
    private String serializeLoginState(int failedLoginCount, Instant lastLoginAt) {
        try {
            return objectMapper.writeValueAsString(new LoginStateSnapshot(failedLoginCount, lastLoginAt));
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private record LoginStateSnapshot(int failedLoginCount, Instant lastLoginAt) {
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
            // The one transition in this method actually worth its own audit
            // row — every failed attempt below the threshold is just a
            // counter increment, but crossing it changes the account's
            // status, which AUDT-US-005's reviewers need visibility into.
            auditLogService.append(user.getId(), null, "ACCOUNT_LOCKED", "User", user.getId().toString(),
                    null, "failedLoginCount: " + user.getFailedLoginCount());
        }
    }
}
