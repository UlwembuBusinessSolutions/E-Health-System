package co.ehealth.platform.identity.mfa;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.UUID;

interface MfaRecoveryCodeRepository extends JpaRepository<MfaRecoveryCode, UUID> {
    long countByUserIdAndUsedAtIsNull(UUID userId);

    void deleteByUserId(UUID userId);

    // Atomic single-use: 0 rows updated means unknown or already used.
    @Modifying
    @Query("update MfaRecoveryCode c set c.usedAt = :now where c.userId = :uid and c.codeHash = :hash and c.usedAt is null")
    int consume(@Param("uid") UUID userId, @Param("hash") String hash, @Param("now") Instant now);
}