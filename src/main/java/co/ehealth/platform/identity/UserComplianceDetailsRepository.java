package co.ehealth.platform.identity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserComplianceDetailsRepository extends JpaRepository<UserComplianceDetails, UUID> {
}
