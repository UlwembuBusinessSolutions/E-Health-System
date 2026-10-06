package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.*;

public interface PharmacyDutyRepository extends JpaRepository<PharmacyDutyEntry, UUID> {
    @Query("select d from PharmacyDutyEntry d where d.facilityId=:facility and d.endedAt is null and d.expiresAt>:now order by d.startedAt desc, d.id")
    List<PharmacyDutyEntry> active(@Param("facility") UUID facility, @Param("now") Instant now);
    List<PharmacyDutyEntry> findTop50ByFacilityIdOrderByStartedAtDesc(UUID facilityId);
}

