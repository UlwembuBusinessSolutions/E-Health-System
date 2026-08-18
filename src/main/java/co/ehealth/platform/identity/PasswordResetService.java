package co.ehealth.platform.identity;

import co.ehealth.platform.core.audit.AuditLogService;
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

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetTokenRepository tokenRepository,
            PasswordEncoder passwordEncoder,
            AuditLogService auditLogService,
            Clock clock
    ) {
        this.userRepository = userRepository;
        this.tokenRepository = tokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional
    public void requestReset(String email, String requestIp) {
        Optional<User> maybeUser = userRepository.findByEmail(email);

        // Always returns normally whether or not the email matched —
        // same account-enumeration guard as login's identical 401.
        if (maybeUser.isEmpty()) {
            return;
        }

        String code = String.format(
                "%06d",
                RANDOM.nextInt(1_000_000)
        );

        // BCrypt on a 6-digit code is a deliberate choice.
        // The code is short-lived and should also be rate limited.
        PasswordResetToken token = new PasswordResetToken(
                maybeUser.get().getId(),
                passwordEncoder.encode(code),
                clock.instant().plus(CODE_TTL),
                requestIp
        );

        tokenRepository.save(token);
    }

    @Transactional(
            noRollbackFor = InvalidResetCodeException.class
    )
    public void confirmReset(
            String email,
            String code,
            String newPassword,
            String requestIp
    ) {
        Optional<User> maybeUser =
                userRepository.findByEmail(email);

        Optional<PasswordResetToken> maybeToken =
                maybeUser
                        .flatMap(user ->
                                tokenRepository
                                        .findTopByUserIdAndConsumedAtIsNullOrderByCreatedAtDesc(
                                                user.getId()
                                        )
                        )
                        .filter(token ->
                                !token.isExpired(clock.instant())
                                        && token.getAttemptCount() < MAX_ATTEMPTS
                        );

        String hashToCheck =
                maybeToken
                        .map(PasswordResetToken::getCodeHash)
                        .orElse(DummyHash.VALUE);

        boolean codeMatches =
                passwordEncoder.matches(code, hashToCheck);

        if (maybeUser.isEmpty()
                || maybeToken.isEmpty()
                || !codeMatches) {

            maybeToken.ifPresent(
                    PasswordResetToken::incrementAttempts
            );

            throw new InvalidResetCodeException();
        }

        User user = maybeUser.get();
        PasswordResetToken token = maybeToken.get();

        user.setPasswordHash(
                passwordEncoder.encode(newPassword)
        );

        token.markConsumed(clock.instant());

        tokenRepository.invalidateOutstandingTokens(
                user.getId(),
                clock.instant()
        );

        // Audit successful password reset.
        // requestIp is passed to AuditLogService as the IP address.
        auditLogService.append(
                user.getId(),
                null,
                "PASSWORD_RESET",
                "User",
                user.getId().toString(),
                null,
                null,
                requestIp
        );
    }
}