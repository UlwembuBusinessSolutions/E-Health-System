package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.security.DummyHash;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.Optional;

@Service
public class PasswordResetService {

    private static final Duration CODE_TTL = Duration.ofMinutes(10);
    private static final int MAX_ATTEMPTS = 5;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final EmailService emailService;

    public PasswordResetService(UserRepository userRepository, PasswordResetTokenRepository tokenRepository,
                                 PasswordEncoder passwordEncoder, AuditLogService auditLogService, Clock clock,
                                 EmailService emailService) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.emailService = emailService;
    }

    @Transactional
    public void requestReset(String email, String requestIp) {
        Optional<User> maybeUser = userRepository.findByEmail(email);
        // Always returns normally whether or not the email matched — same
        // account-enumeration guard as login's identical 401.
        if (maybeUser.isEmpty()) {
            return;
        }

        String code = String.format("%06d", RANDOM.nextInt(1_000_000));
        // BCrypt on a 6-digit code is a deliberate choice, not an odd reuse
        // of a password hasher: a 6-digit keyspace (1,000,000 values) is
        // only brute-force resistant if guessing it is slow AND rate
        // limited AND short-lived — this covers the "slow" leg without a
        // second hashing library.
        User user = maybeUser.get();
        PasswordResetToken token = new PasswordResetToken(user.getId(),
                passwordEncoder.encode(code), clock.instant().plus(CODE_TTL), requestIp);
        tokenRepository.save(token);

        // The code is never stored anywhere the client can read it back
        // from (only its bcrypt hash lives in password_reset_tokens) — this
        // email is the one place it exists in plaintext, same "capture-to-file
        // first, then attempt real SMTP" delivery path every other account
        // email already goes through.
        emailService.sendPasswordResetCodeEmail(user.getEmail(), user.getFirstName(), code, CODE_TTL.toMinutes());
    }

    // noRollbackFor is load-bearing — same reasoning as AuthService.login():
    // the invalid-code branch below calls token.incrementAttempts() and
    // then throws InvalidResetCodeException, and Spring's default
    // @Transactional rollback-on-unchecked-exception would silently
    // discard that increment on every wrong guess, making MAX_ATTEMPTS
    // unenforceable — a code could be guessed an unlimited number of
    // times instead of 5.
    @Transactional(noRollbackFor = InvalidResetCodeException.class)
    public void confirmReset(String email, String code, String newPassword) {
        Optional<User> maybeUser = userRepository.findByEmail(email);
        Optional<PasswordResetToken> maybeToken = maybeUser
                .flatMap(u -> tokenRepository.findTopByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(u.getId()))
                .filter(t -> !t.isExpired(clock.instant()) && t.getAttemptCount() < MAX_ATTEMPTS);

        String hashToCheck = maybeToken.map(PasswordResetToken::getCodeHash).orElse(DummyHash.VALUE);
        boolean codeMatches = passwordEncoder.matches(code, hashToCheck);

        if (maybeUser.isEmpty() || maybeToken.isEmpty() || !codeMatches) {
            maybeToken.ifPresent(PasswordResetToken::incrementAttempts);
            throw new InvalidResetCodeException();
        }

        User user = maybeUser.get();
        PasswordResetToken token = maybeToken.get();

        user.setPasswordHash(passwordEncoder.encode(newPassword)); // bumps tokenVersion — see User.java
        token.markConsumed(clock.instant());
        tokenRepository.invalidateOutstandingTokens(user.getId(), clock.instant());

        auditLogService.append(user.getId(), null, "PASSWORD_RESET", "User", user.getId().toString(),
                null, null);
    }
}
