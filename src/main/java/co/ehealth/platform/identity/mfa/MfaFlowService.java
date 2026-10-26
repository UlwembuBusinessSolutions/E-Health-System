package co.ehealth.platform.identity.mfa;

import co.ehealth.platform.core.security.JwtService;
import co.ehealth.platform.identity.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
public class MfaFlowService {

    public record Completed(JwtService.IssuedToken token, User user, List<String> recoveryCodes,
            Integer recoveryCodesRemaining) {
    }

    public record Status(boolean enrolled, boolean required, boolean canDisable, long recoveryCodesRemaining) {
    }

    private static final long LOCKOUT_SECONDS = Duration.ofMinutes(30).toSeconds(); // = AuthService.LOCKOUT_DURATION
    private static final int LOW_RECOVERY_CODES = 2;

    private final MfaService mfa;
    private final AuthService authService;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public MfaFlowService(MfaService mfa, AuthService authService, UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.mfa = mfa;
        this.authService = authService;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ===== login: second step =====
    @Transactional(noRollbackFor = { InvalidMfaCodeException.class, AccountLockedException.class })
    public Completed verifyLogin(String challengeToken, String code, String recoveryCode) {
        MfaChallenge ch = mfa.findActiveChallenge(challengeToken, MfaChallenge.Purpose.VERIFY)
                .orElseThrow(MfaChallengeExpiredException::new);
        User user = activeUser(ch);
        mfa.recordChallengeAttempt(ch);

        boolean viaRecovery = !StringUtils.hasText(code) && StringUtils.hasText(recoveryCode);
        boolean ok;
        if (StringUtils.hasText(code))
            ok = mfa.checkTotp(user.getId(), code);
        else if (viaRecovery)
            ok = mfa.useRecoveryCode(user.getId(), recoveryCode);
        else
            throw new InvalidMfaCodeException();
        if (!ok)
            throw failure(user.getId());

        mfa.consume(ch);
        JwtService.IssuedToken token = authService.completeMfaLogin(user.getId());
        mfa.audit(user.getId(), "MFA_VERIFIED");
        Integer remaining = null;
        if (viaRecovery) {
            long left = mfa.recoveryCodesRemaining(user.getId());
            remaining = left <= LOW_RECOVERY_CODES ? (int) left : null; // warn only when running low
        }
        return new Completed(token, user, null, remaining);
    }

    // ===== login: forced enrolment (mandatory role, not yet enrolled) =====
    @Transactional
    public MfaService.EnrolmentSecret startChallengeEnrolment(String challengeToken) {
        MfaChallenge ch = mfa.findActiveChallenge(challengeToken, MfaChallenge.Purpose.ENROL)
                .orElseThrow(MfaChallengeExpiredException::new);
        return mfa.beginEnrolment(activeUser(ch));
    }

    @Transactional(noRollbackFor = { InvalidMfaCodeException.class, AccountLockedException.class })
    public Completed confirmChallengeEnrolment(String challengeToken, String code) {
        MfaChallenge ch = mfa.findActiveChallenge(challengeToken, MfaChallenge.Purpose.ENROL)
                .orElseThrow(MfaChallengeExpiredException::new);
        User user = activeUser(ch);
        mfa.recordChallengeAttempt(ch);
        List<String> codes = mfa.confirmEnrolment(user.getId(), code).orElseThrow(() -> failure(user.getId()));
        mfa.consume(ch);
        JwtService.IssuedToken token = authService.completeMfaLogin(user.getId());
        return new Completed(token, user, codes, null);
    }

    // ===== authenticated self-service =====
    public Status status(UUID userId) {
        boolean mandatory = mfa.isMandatory(userId);
        return new Status(mfa.isEnrolled(userId), mandatory, !mandatory, mfa.recoveryCodesRemaining(userId));
    }

    @Transactional
    public MfaService.EnrolmentSecret startSelfEnrolment(UUID userId) {
        return mfa.beginEnrolment(userRepository.findById(userId).orElseThrow(InvalidCredentialsException::new));
    }

    @Transactional
    public List<String> confirmSelfEnrolment(UUID userId, String code) {
        return mfa.confirmEnrolment(userId, code).orElseThrow(InvalidMfaCodeException::new);
    }

    @Transactional(noRollbackFor = { InvalidMfaCodeException.class, AccountLockedException.class })
    public List<String> regenerateRecoveryCodes(UUID userId, String code) {
        requireCurrentCode(userId, code);
        return mfa.regenerateRecoveryCodes(userId);
    }

    @Transactional(noRollbackFor = { InvalidMfaCodeException.class, AccountLockedException.class })
    public void disable(UUID userId, String password, String code) {
        User user = userRepository.findById(userId).orElseThrow(InvalidCredentialsException::new);
        if (mfa.isMandatory(userId)) {
            throw new InvalidMfaStateException("MFA is required for your role and can't be turned off.");
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new InvalidMfaCodeException("Incorrect password or code.");
        }
        requireCurrentCode(userId, code);
        mfa.removeEnrolment(userId);
        mfa.audit(userId, "MFA_DISABLED");
    }

    // ===== helpers =====
    private void requireCurrentCode(UUID userId, String code) {
        if (!mfa.checkTotp(userId, code))
            throw failure(userId);
    }

    private RuntimeException failure(UUID userId) {
        return mfa.registerFailure(userId) ? new AccountLockedException(LOCKOUT_SECONDS)
                : new InvalidMfaCodeException();
    }

    private User activeUser(MfaChallenge ch) {
        return userRepository.findById(ch.getUserId()).filter(u -> u.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(MfaChallengeExpiredException::new);
    }
}