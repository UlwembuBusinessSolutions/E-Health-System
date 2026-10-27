package co.ehealth.platform.identity.mfa;

import co.ehealth.platform.core.audit.AuditDetails;
import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MfaAdminService {

    public record PolicyView(UUID roleId, String roleName, MfaPolicy policy) {
    }

    private final RoleRepository roleRepository;
    private final RoleMfaPolicyRepository policyRepository;
    private final UserRepository userRepository;
    private final MfaService mfa;
    private final AuditLogService audit;
    private final Clock clock;

    public MfaAdminService(RoleRepository roleRepository, RoleMfaPolicyRepository policyRepository,
            UserRepository userRepository, MfaService mfa, AuditLogService audit, Clock clock) {
        this.roleRepository = roleRepository;
        this.policyRepository = policyRepository;
        this.userRepository = userRepository;
        this.mfa = mfa;
        this.audit = audit;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<PolicyView> listPolicies() {
        Map<UUID, MfaPolicy> byRole = policyRepository.findAll().stream()
                .collect(Collectors.toMap(p -> p.roleId, p -> p.policy));
        return roleRepository.findAll().stream().sorted(Comparator.comparing(Role::getName))
                .map(r -> new PolicyView(r.getId(), r.getName(), byRole.getOrDefault(r.getId(), MfaPolicy.OPTIONAL)))
                .toList();
    }

    @Transactional
    public PolicyView setPolicy(UUID roleId, MfaPolicy policy, UUID actorUserId) {
        Role role = roleRepository.findById(roleId).orElseThrow(RoleNotFoundException::new);
        RoleMfaPolicy row = policyRepository.findById(roleId).orElseGet(() -> new RoleMfaPolicy(roleId));
        MfaPolicy before = row.policy == null ? MfaPolicy.OPTIONAL : row.policy;
        row.set(policy, actorUserId, clock.instant());
        policyRepository.save(row);
        audit.append(actorUserId, null, "MFA_POLICY_CHANGED", "Role", roleId.toString(),
                AuditDetails.of("role", role.getName(), "policy", before.name()),
                AuditDetails.of("role", role.getName(), "policy", policy.name()));
        return new PolicyView(roleId, role.getName(), policy);
    }

    /**
     * Lost device and no recovery codes. Clears MFA and kills existing sessions; a
     * mandatory role
     * re-enrols at the next login. actorUserId is null when a platform operator
     * performs it.
     */
    @Transactional
    public void resetUserMfa(UUID userId, UUID actorUserId, UUID platformOperatorId) {
        if (actorUserId != null && actorUserId.equals(userId)) {
            throw new InvalidMfaStateException("You can't reset your own MFA. Ask another administrator.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown staff member"));
        mfa.removeEnrolment(userId);
        user.revokeSessions();
        userRepository.save(user);
        audit.append(actorUserId, user.getFacilityId(), "MFA_RESET", "User", userId.toString(), null,
                AuditDetails.of("platformOperatorId",
                        platformOperatorId == null ? null : platformOperatorId.toString()));
    }
}