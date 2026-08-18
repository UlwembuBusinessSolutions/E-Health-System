package co.ehealth.platform.platform;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlatformOperatorRepository extends JpaRepository<PlatformOperator, UUID> {
    Optional<PlatformOperator> findByEmail(String email);

    boolean existsByEmail(String email);
}
