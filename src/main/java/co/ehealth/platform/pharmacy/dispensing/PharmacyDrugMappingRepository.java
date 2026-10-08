package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyDrugMappingRepository extends JpaRepository<PharmacyDrugMapping, UUID> {

    Optional<PharmacyDrugMapping> findByDrugNameKey(String drugNameKey);

    List<PharmacyDrugMapping> findByDrugNameKeyIn(Collection<String> drugNameKeys);
}
