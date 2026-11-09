package co.ehealth.platform.identity.mfa;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

interface MfaChallengeRepository extends JpaRepository<MfaChallenge, UUID> {
    Optional<MfaChallenge> findByTokenHash(String tokenHash);

    @Modifying
    @Query("delete from MfaChallenge c where c.userId = :uid or c.expiresAt < :now")
    void purge(@Param("uid") UUID userId, @Param("now") Instant now);
}