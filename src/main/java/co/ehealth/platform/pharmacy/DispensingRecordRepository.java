package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface DispensingRecordRepository extends JpaRepository<DispensingRecord, UUID> {

    @Query("select record from DispensingRecord record where record.patientId = :patientId "
            + "and record.coverageUntil >= :today and record.prescriptionId <> :prescriptionId")
    List<DispensingRecord> findActiveForPatient(@Param("patientId") UUID patientId,
            @Param("prescriptionId") UUID prescriptionId, @Param("today") LocalDate today);

    @Query("select count(record) from DispensingRecord record join Prescription prescription "
	    + "on prescription.id = record.prescriptionId where prescription.facilityId = :facilityId "
	    + "and record.dispensedAt >= :startedAt and record.dispensedAt < :endsAt")
    long countDispensedByFacilityBetween(@Param("facilityId") UUID facilityId,
					 @Param("startedAt") Instant startedAt,
					 @Param("endsAt") Instant endsAt);
}
