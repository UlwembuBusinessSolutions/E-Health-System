package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;

import java.util.Optional;
import java.util.UUID;
import java.time.Instant;

public interface PatientRegistrationVerificationRepository
        extends JpaRepository<PatientRegistrationVerification, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<PatientRegistrationVerification> findTopByEmailAndConsumedAtIsNullOrderByCreatedAtDesc(String email);
    void deleteByEmailOrIdNumber(String email, String idNumber);
    void deleteByExpiresAtBefore(Instant cutoff);
}
