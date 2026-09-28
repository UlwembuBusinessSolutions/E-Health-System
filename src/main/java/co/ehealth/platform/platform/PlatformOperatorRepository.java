package co.ehealth.platform.platform;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlatformOperatorRepository extends JpaRepository<PlatformOperator, UUID> {
    Optional<PlatformOperator> findByEmail(String email);

    boolean existsByEmail(String email);

    // PlatformOperatorService.setEnabled()'s own guard — disabling the last
    // ACTIVE operator would lock every human out of the platform console
    // with no recovery path (platform operators have no self-service
    // password reset, unlike tenant staff's /api/v1/auth/password-reset/**).
    long countByStatus(PlatformOperatorStatus status);
}
