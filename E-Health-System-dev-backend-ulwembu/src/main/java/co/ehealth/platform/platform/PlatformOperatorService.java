package co.ehealth.platform.platform;

import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.security.TemporaryPasswordGenerator;
import co.ehealth.platform.identity.DuplicateFieldException;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// The admin-creates-admin path platform_operators has never had — see the
// why-note on PlatformOperatorBootstrap for the gap this closes. Every
// operator after the very first now comes from here: an existing,
// authenticated operator creating the next one, rather than direct database
// access or the dev-only bootstrap runner. @Transactional is safe here, same
// reasoning as PlatformAuthService: platform_operators lives entirely in the
// control schema, no tenant-context switching involved.
@Service
public class PlatformOperatorService {

    private final PlatformOperatorRepository platformOperatorRepository;
    private final PasswordEncoder passwordEncoder;
    private final PlatformAuditLogRepository platformAuditLogRepository;
    private final EmailService emailService;
    private final TemporaryPasswordGenerator temporaryPasswordGenerator;

    public PlatformOperatorService(PlatformOperatorRepository platformOperatorRepository,
                                    PasswordEncoder passwordEncoder,
                                    PlatformAuditLogRepository platformAuditLogRepository,
                                    EmailService emailService,
                                    TemporaryPasswordGenerator temporaryPasswordGenerator) {
        this.platformOperatorRepository = platformOperatorRepository;
        this.passwordEncoder = passwordEncoder;
        this.platformAuditLogRepository = platformAuditLogRepository;
        this.emailService = emailService;
        this.temporaryPasswordGenerator = temporaryPasswordGenerator;
    }

    @Transactional
    public CreatedOperator createOperator(CreateOperatorCommand cmd, UUID actingOperatorId) {
        if (platformOperatorRepository.existsByEmail(cmd.email())) {
            throw new DuplicateFieldException("email", "A platform operator with this email already exists.");
        }

        String temporaryPassword = temporaryPasswordGenerator.generate();
        PlatformOperator created = new PlatformOperator(
                cmd.email(), cmd.firstName(), cmd.lastName(), passwordEncoder.encode(temporaryPassword));
        platformOperatorRepository.save(created);

        // organizationId null — this action isn't about any organization,
        // same reasoning as PlatformAuditLog's own why-note on that column.
        platformAuditLogRepository.save(
                new PlatformAuditLog(actingOperatorId, "PLATFORM_OPERATOR_CREATED", null, Instant.now()));

        // A failed send is swallowed inside EmailService and never affects
        // the account creation itself, same trade-off as
        // OrganizationProvisioningService.createAdminUser().
        emailService.sendPlatformOperatorAccountCreatedEmail(created.getEmail(), created.getFirstName(),
                temporaryPassword);

        return new CreatedOperator(created.getId(), created.getEmail(), created.getFirstName(),
                created.getLastName(), temporaryPassword);
    }

    // The read half — every screen that manages platform operators needs
    // to see who already exists before creating another one. Never
    // PlatformOperator itself: passwordHash has no business leaving this
    // service, same reasoning as StaffService.AdminSummary on the tenant
    // side.
    public List<OperatorSummary> listOperators() {
        return platformOperatorRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .map(OperatorSummary::from)
                .toList();
    }

    // Admin-triggered, unlike the self-service /api/v1/auth/password-reset/**
    // flow tenant staff has — platform operators have no equivalent
    // self-service path at all, so "another operator generates and hands you
    // a new one" is the only recovery lever that exists here. Same
    // discipline as createOperator(): returned exactly once, emailed once,
    // never stored anywhere retrievable afterward.
    @Transactional
    public String resetPassword(UUID operatorId, UUID actingOperatorId) {
        PlatformOperator operator = platformOperatorRepository.findById(operatorId)
                .orElseThrow(PlatformOperatorNotFoundException::new);
        String temporaryPassword = temporaryPasswordGenerator.generate();
        operator.setPasswordHash(passwordEncoder.encode(temporaryPassword));
        platformOperatorRepository.save(operator);

        platformAuditLogRepository.save(
                new PlatformAuditLog(actingOperatorId, "PLATFORM_OPERATOR_PASSWORD_RESET", null, Instant.now()));
        emailService.sendPlatformOperatorPasswordResetEmail(operator.getEmail(), operator.getFirstName(),
                temporaryPassword);

        return temporaryPassword;
    }

    // The write half of the "ability to disable the user" requirement —
    // enabled=false is the actual lever (a suspended operator can't sign
    // in; SecurityFilterChain never checks status beyond what PlatformAuthService.login()
    // already gates on ACTIVE), enabled=true reverses it. Guards against
    // disabling the last ACTIVE operator — PlatformOperatorRepository.countByStatus()'s
    // own why-note on why that guard exists at all.
    @Transactional
    public void setEnabled(UUID operatorId, boolean enabled, UUID actingOperatorId) {
        PlatformOperator operator = platformOperatorRepository.findById(operatorId)
                .orElseThrow(PlatformOperatorNotFoundException::new);
        if (!enabled && operator.getStatus() == PlatformOperatorStatus.ACTIVE
                && platformOperatorRepository.countByStatus(PlatformOperatorStatus.ACTIVE) <= 1) {
            throw new LastActiveOperatorException();
        }

        operator.setStatus(enabled ? PlatformOperatorStatus.ACTIVE : PlatformOperatorStatus.DISABLED);
        platformOperatorRepository.save(operator);

        platformAuditLogRepository.save(new PlatformAuditLog(actingOperatorId,
                enabled ? "PLATFORM_OPERATOR_ENABLED" : "PLATFORM_OPERATOR_DISABLED", null, Instant.now()));
    }

    // Same "LOCKED is an automatic consequence, not the same lever as
    // enable/disable" reasoning as StaffService.unlockAccount() — a
    // locked-out operator has no self-service password reset, so another
    // operator clearing the lockout early is the only way back in short of
    // waiting out LOCKOUT_DURATION. No-ops if the account isn't currently
    // LOCKED.
    @Transactional
    public void unlock(UUID operatorId, UUID actingOperatorId) {
        PlatformOperator operator = platformOperatorRepository.findById(operatorId)
                .orElseThrow(PlatformOperatorNotFoundException::new);
        if (operator.getStatus() != PlatformOperatorStatus.LOCKED) {
            return;
        }

        operator.unlock();
        platformOperatorRepository.save(operator);

        platformAuditLogRepository.save(
                new PlatformAuditLog(actingOperatorId, "PLATFORM_OPERATOR_UNLOCKED", null, Instant.now()));
    }

    // Permanent removal, unlike setEnabled(false) above — that's the
    // reversible "suspend" lever; this is for an operator who was created
    // by mistake or never used their account and should stop existing
    // entirely. Same last-ACTIVE-operator guard as setEnabled(): the
    // platform must always have at least one way in. Checks for existing
    // audit history explicitly (OperatorHasAuditHistoryException, a clear
    // 409) rather than letting Postgres's own foreign-key violation
    // surface as the generic DataIntegrityViolationException 409 — same
    // constraint either way (platform_audit_log has no ON DELETE CASCADE),
    // just a message that actually explains why.
    @Transactional
    public void delete(UUID operatorId, UUID actingOperatorId) {
        PlatformOperator operator = platformOperatorRepository.findById(operatorId)
                .orElseThrow(PlatformOperatorNotFoundException::new);
        if (operator.getStatus() == PlatformOperatorStatus.ACTIVE
                && platformOperatorRepository.countByStatus(PlatformOperatorStatus.ACTIVE) <= 1) {
            throw new LastActiveOperatorException();
        }
        if (platformAuditLogRepository.existsByPlatformOperatorId(operatorId)) {
            throw new OperatorHasAuditHistoryException();
        }

        platformAuditLogRepository.save(
                new PlatformAuditLog(actingOperatorId, "PLATFORM_OPERATOR_DELETED", null, Instant.now()));
        platformOperatorRepository.delete(operator);
    }

    public record CreateOperatorCommand(String firstName, String lastName, String email) {
    }

    // temporaryPassword is returned exactly once, in this response — never
    // stored anywhere retrievable, never logged. Same discipline as
    // OrganizationProvisioningService.ProvisionedAdmin.
    public record CreatedOperator(UUID id, String email, String firstName, String lastName,
                                   String temporaryPassword) {
    }

    public record OperatorSummary(UUID id, String email, String firstName, String lastName,
                                   PlatformOperatorStatus status, Instant lastLoginAt, Instant createdAt) {
        static OperatorSummary from(PlatformOperator o) {
            return new OperatorSummary(o.getId(), o.getEmail(), o.getFirstName(), o.getLastName(), o.getStatus(),
                    o.getLastLoginAt(), o.getCreatedAt());
        }
    }
}
