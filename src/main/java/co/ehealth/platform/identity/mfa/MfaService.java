package co.ehealth.platform.identity.mfa;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.common.SecretEncryptor;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class MfaService {

    public enum Requirement {
        NONE, VERIFY, ENROL
    }

    public record ChallengeIssued(String token, Instant expiresAt, boolean enrolmentRequired) {
    }

    public record EnrolmentSecret(String secret, String otpauthUri) {
    }

    static final int MAX_FAILED_CODES = 5;
    static final int MAX_CHALLENGE_ATTEMPTS = 5;
    static final Duration CHALLENGE_TTL = Duration.ofMinutes(10);
    static final int RECOVERY_CODE_COUNT = 10;
    private static final String ISSUER = "Ulwembu";
    // No I/O/0/1: easy to misread when copied by hand. 12 chars x 5 bits = 60 bits.
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final UserMfaRepository userMfaRepository;
    private final MfaRecoveryCodeRepository recoveryRepository;
    private final MfaChallengeRepository challengeRepository;
    private final RoleMfaPolicyRepository policyRepository;
    private final UserRepository userRepository;
    private final TotpService totp;
    private final SecretEncryptor encryptor;
    private final AuditLogService audit;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public MfaService(UserMfaRepository userMfaRepository, MfaRecoveryCodeRepository recoveryRepository,
            MfaChallengeRepository challengeRepository, RoleMfaPolicyRepository policyRepository,
            UserRepository userRepository, TotpService totp, SecretEncryptor encryptor,
            AuditLogService audit, Clock clock) {
        this.userMfaRepository = userMfaRepository;
        this.recoveryRepository = recoveryRepository;
        this.challengeRepository = challengeRepository;
        this.policyRepository = policyRepository;
        this.userRepository = userRepository;
        this.totp = totp;
        this.encryptor = encryptor;
        this.audit = audit;
        this.clock = clock;
    }

    // ---- policy ----
    public boolean isEnrolled(UUID userId) {
        return userMfaRepository.findById(userId).filter(m -> m.status == UserMfa.Status.ACTIVE).isPresent();
    }

    public boolean isMandatory(UUID userId) {
        return policyRepository.existsMandatoryForUser(userId);
    }

    public Requirement requirementFor(UUID userId) {
        if (isEnrolled(userId))
            return Requirement.VERIFY;
        return isMandatory(userId) ? Requirement.ENROL : Requirement.NONE;
    }

    public long recoveryCodesRemaining(UUID userId) {
        return recoveryRepository.countByUserIdAndUsedAtIsNull(userId);
    }

    // ---- challenges ----
    @Transactional
    public ChallengeIssued createChallenge(UUID userId, MfaChallenge.Purpose purpose) {
        Instant now = clock.instant();
        challengeRepository.purge(userId, now);
        byte[] raw = new byte[32];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        Instant expires = now.plus(CHALLENGE_TTL);
        challengeRepository.save(new MfaChallenge(hash(token), userId, purpose, expires, now));
        return new ChallengeIssued(token, expires, purpose == MfaChallenge.Purpose.ENROL);
    }

    public Optional<MfaChallenge> findActiveChallenge(String rawToken, MfaChallenge.Purpose purpose) {
        if (rawToken == null || rawToken.isBlank())
            return Optional.empty();
        Instant now = clock.instant();
        return challengeRepository.findByTokenHash(hash(rawToken))
                .filter(c -> c.consumedAt == null && c.expiresAt.isAfter(now)
                        && c.purpose == purpose && c.attemptCount < MAX_CHALLENGE_ATTEMPTS);
    }

    @Transactional
    public void recordChallengeAttempt(MfaChallenge c) {
        c.attemptCount++;
    }

    @Transactional
    public void consume(MfaChallenge c) {
        c.consumedAt = clock.instant();
    }

    // ---- enrolment ----
    @Transactional
    public EnrolmentSecret beginEnrolment(User user) {
        Optional<UserMfa> existing = userMfaRepository.findForUpdate(user.getId());
        if (existing.isPresent() && existing.get().status == UserMfa.Status.ACTIVE) {
            throw new InvalidMfaStateException("MFA is already set up for this account.");
        }
        byte[] secret = totp.newSecret();
        UserMfa m = existing.orElseGet(() -> new UserMfa(user.getId(), clock.instant()));
        m.secretEncrypted = encryptor.encrypt(Base64.getEncoder().encodeToString(secret));
        m.status = UserMfa.Status.PENDING;
        m.lastUsedStep = 0;
        m.failedAttempts = 0;
        userMfaRepository.save(m);
        String b32 = totp.base32(secret);
        return new EnrolmentSecret(b32, totp.provisioningUri(ISSUER, user.getEmail(), b32));
    }

    /**
     * Empty = wrong code. Present = now ACTIVE, with the one-time-visible recovery
     * codes.
     */
    @Transactional
    public Optional<List<String>> confirmEnrolment(UUID userId, String code) {
        UserMfa m = userMfaRepository.findForUpdate(userId).filter(x -> x.status == UserMfa.Status.PENDING)
                .orElseThrow(() -> new InvalidMfaStateException("Start MFA set-up first."));
        long step = totp.matchStep(secretOf(m), clean(code), clock.instant());
        if (step < 0)
            return Optional.empty();
        m.status = UserMfa.Status.ACTIVE;
        m.enrolledAt = clock.instant();
        m.lastUsedStep = step;
        m.failedAttempts = 0;
        List<String> codes = regenerateRecoveryCodes(userId);
        audit(userId, "MFA_ENROLLED");
        return Optional.of(codes);
    }

    // ---- verification ----
    @Transactional
    public boolean checkTotp(UUID userId, String code) {
        UserMfa m = userMfaRepository.findForUpdate(userId).filter(x -> x.status == UserMfa.Status.ACTIVE).orElse(null);
        if (m == null)
            return false;
        long step = totp.matchStep(secretOf(m), clean(code), clock.instant());
        if (step < 0 || step <= m.lastUsedStep)
            return false; // wrong, or replayed
        m.lastUsedStep = step;
        m.failedAttempts = 0;
        return true;
    }

    @Transactional
    public boolean useRecoveryCode(UUID userId, String raw) {
        String normalized = normalizeRecovery(raw);
        if (normalized.length() != 12)
            return false;
        boolean ok = recoveryRepository.consume(userId, hash(normalized), clock.instant()) == 1;
        if (ok) {
            userMfaRepository.findForUpdate(userId).ifPresent(m -> m.failedAttempts = 0);
            audit(userId, "MFA_RECOVERY_CODE_USED");
        }
        return ok;
    }

    /** Counts a wrong code. Returns true when this failure locked the account. */
    @Transactional
    public boolean registerFailure(UUID userId) {
        audit(userId, "MFA_VERIFICATION_FAILED");
        Optional<UserMfa> row = userMfaRepository.findForUpdate(userId);
        if (row.isEmpty())
            return false;
        UserMfa m = row.get();
        if (++m.failedAttempts < MAX_FAILED_CODES)
            return false;
        m.failedAttempts = 0;
        userRepository.findById(userId).ifPresent(u -> u.lock(clock.instant())); // 30-min auto-unlock in AuthService
        audit(userId, "MFA_LOCKOUT");
        return true;
    }

    // ---- recovery codes / removal ----
    @Transactional
    public List<String> regenerateRecoveryCodes(UUID userId) {
        recoveryRepository.deleteByUserId(userId);
        recoveryRepository.flush();
        Instant now = clock.instant();
        List<String> plain = new ArrayList<>();
        for (int i = 0; i < RECOVERY_CODE_COUNT; i++) {
            StringBuilder sb = new StringBuilder();
            for (int c = 0; c < 12; c++)
                sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
            plain.add(sb.substring(0, 4) + "-" + sb.substring(4, 8) + "-" + sb.substring(8));
            recoveryRepository.save(new MfaRecoveryCode(userId, hash(sb.toString()), now));
        }
        return plain;
    }

    @Transactional
    public void removeEnrolment(UUID userId) {
        recoveryRepository.deleteByUserId(userId);
        userMfaRepository.deleteById(userId);
        challengeRepository.purge(userId, clock.instant());
    }

    // ---- helpers ----
    private byte[] secretOf(UserMfa m) {
        return Base64.getDecoder().decode(encryptor.decrypt(m.secretEncrypted));
    }

    private static String clean(String code) {
        return code == null ? null : code.replaceAll("\\s", "");
    }

    private static String normalizeRecovery(String raw) {
        return raw == null ? "" : raw.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    void audit(UUID userId, String action) {
        audit.append(userId, null, action, "User", userId.toString(), null, null);
    }

    static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}