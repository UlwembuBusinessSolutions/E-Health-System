package co.ehealth.platform.platform;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PlatformPasswordResetTokenRepository extends JpaRepository<PlatformPasswordResetToken, UUID> {
    Optional<PlatformPasswordResetToken> findTopByOperatorIdAndConsumedAtIsNullOrderByCreatedAtDesc(UUID operatorId);

    java.util.List<PlatformPasswordResetToken> findByOperatorIdAndConsumedAtIsNullOrderByCreatedAtDesc(UUID operatorId);

    @Modifying
    @Query("update PlatformPasswordResetToken t set t.consumedAt = :now where t.operatorId = :operatorId and t.consumedAt is null")
    void invalidateOutstandingTokens(@Param("operatorId") UUID operatorId, @Param("now") Instant now);
}
