package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PharmacyProductIndicationRepository extends JpaRepository<PharmacyProductIndication, UUID> {

    List<PharmacyProductIndication> findByProductId(UUID productId);

    List<PharmacyProductIndication> findByIcd10Code(String icd10Code);
}
