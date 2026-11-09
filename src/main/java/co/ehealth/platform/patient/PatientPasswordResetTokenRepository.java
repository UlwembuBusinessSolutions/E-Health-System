package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;

public interface PatientPasswordResetTokenRepository extends JpaRepository<PatientPasswordResetToken, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PatientPasswordResetToken> findTopByPatientAccountIdAndConsumedAtIsNullOrderByCreatedAtDesc(
            UUID patientAccountId);

    @Modifying
    @Query("update PatientPasswordResetToken t set t.consumedAt = :now " +
            "where t.patientAccountId = :accountId and t.consumedAt is null")
    int invalidateOutstanding(@Param("accountId") UUID accountId, @Param("now") Instant now);
}
