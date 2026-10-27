package co.ehealth.platform.identity.mfa;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
import java.util.UUID;

interface UserMfaRepository extends JpaRepository<UserMfa, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from UserMfa m where m.userId = :id")
    Optional<UserMfa> findForUpdate(@Param("id") UUID id);
}