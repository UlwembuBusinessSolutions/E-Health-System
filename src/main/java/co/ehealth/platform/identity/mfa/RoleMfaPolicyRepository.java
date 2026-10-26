package co.ehealth.platform.identity.mfa;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.UUID;

interface RoleMfaPolicyRepository extends JpaRepository<RoleMfaPolicy, UUID> {
    @Query(value = "SELECT COUNT(*) > 0 FROM user_roles ur JOIN role_mfa_policies p ON p.role_id = ur.role_id "
            + "WHERE ur.user_id = :userId AND p.policy = 'MANDATORY'", nativeQuery = true)
    boolean existsMandatoryForUser(@Param("userId") UUID userId);
}