package co.ehealth.platform.pharmacy.serial;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PharmacySerialUnitRepository extends JpaRepository<PharmacySerialUnit, UUID> {

    List<PharmacySerialUnit> findByProductIdAndSerialNumberIn(UUID productId, Collection<String> serialNumbers);

    List<PharmacySerialUnit> findByReceivedEntryIdInAndStatus(Collection<UUID> receivedEntryIds,
                                                              SerialUnitStatus status);
}
