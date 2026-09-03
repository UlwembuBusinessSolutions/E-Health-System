package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface DispensingRecordRepository extends JpaRepository<DispensingRecord, UUID> {

    @Query("select count(record) from DispensingRecord record join Prescription prescription "
	    + "on prescription.id = record.prescriptionId where prescription.facilityId = :facilityId "
	    + "and record.dispensedAt >= :startedAt and record.dispensedAt < :endsAt")
    long countDispensedByFacilityBetween(@Param("facilityId") UUID facilityId,
					 @Param("startedAt") Instant startedAt,
					 @Param("endsAt") Instant endsAt);
}
