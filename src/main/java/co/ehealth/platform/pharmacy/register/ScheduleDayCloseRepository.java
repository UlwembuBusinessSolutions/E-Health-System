package co.ehealth.platform.pharmacy.register;

import org.springframework.data.repository.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface ScheduleDayCloseRepository extends Repository<ScheduleDayClose, UUID> {

    ScheduleDayClose save(ScheduleDayClose dayClose);

    Optional<ScheduleDayClose> findByFacilityIdAndProductIdAndBusinessDate(UUID facilityId, UUID productId,
                                                                           LocalDate businessDate);

    boolean existsByFacilityIdAndProductIdAndBusinessDate(UUID facilityId, UUID productId, LocalDate businessDate);
}
