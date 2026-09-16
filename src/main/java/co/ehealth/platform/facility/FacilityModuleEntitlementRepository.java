package co.ehealth.platform.facility;

import co.ehealth.platform.core.tenant.ModuleCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FacilityModuleEntitlementRepository extends JpaRepository<FacilityModuleEntitlement, UUID> {
    List<FacilityModuleEntitlement> findByFacilityId(UUID facilityId);

    Optional<FacilityModuleEntitlement> findByFacilityIdAndModuleCode(UUID facilityId, ModuleCode moduleCode);
}