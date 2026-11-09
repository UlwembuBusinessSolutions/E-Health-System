package co.ehealth.platform.clinician;

import co.ehealth.platform.visit.QueueToken;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// The reads behind the clinician Dashboard. Native SQL so each section is one
// round trip. Conventions match the pharmacy read repositories: dates come
// back as ISO text, timestamps as epoch seconds (a quoted "HH:MI" pattern
// would read as a :MI parameter), aliases are quoted for the projections.
public interface ClinicianDashboardRepository extends Repository<QueueToken, UUID> {

    // Today's callable tokens, exactly the set and order
    // QueueTokenRepository.findCallableQueue() uses (PRIORITY first, then
    // earliest issued), so queuePosition 0 is the patient "Call next" would
    // take and calling anyone else is a bypass that needs a reason. The
    // triage colour is the visit's latest active assessment; final_colour
    // already carries any override.
    @Query(value = "SELECT qt.id AS \"tokenId\", qt.token_number AS \"ticketNumber\", qt.priority AS \"priority\", "
            + "CAST(FLOOR(EXTRACT(EPOCH FROM qt.issued_at)) AS BIGINT) AS \"issuedEpoch\", "
            + "CAST(ROW_NUMBER() OVER (ORDER BY CASE WHEN qt.priority = 'PRIORITY' THEN 0 ELSE 1 END, qt.issued_at) - 1 "
            + "AS BIGINT) AS \"queuePosition\", "
            + "v.id AS \"visitId\", v.service_stream AS \"serviceStream\", p.id AS \"patientId\", "
            + "p.first_name AS \"firstName\", p.last_name AS \"lastName\", "
            + "CAST(p.date_of_birth AS VARCHAR) AS \"dateOfBirth\", p.gender AS \"gender\", "
            + "(SELECT ta.final_colour FROM triage_assessments ta WHERE ta.visit_id = v.id AND ta.status = 'ACTIVE' "
            + "ORDER BY ta.observed_at DESC LIMIT 1) AS \"triageColour\" "
            + "FROM queue_tokens qt JOIN visits v ON v.id = qt.visit_id JOIN patients p ON p.id = v.patient_id "
            + "WHERE qt.facility_id = :facilityId AND qt.status = 'ISSUED' "
            + "AND qt.issued_at >= :dayStart AND qt.issued_at < :dayEnd", nativeQuery = true)
    List<WaitingView> waiting(@Param("facilityId") UUID facilityId, @Param("dayStart") Instant dayStart,
                              @Param("dayEnd") Instant dayEnd);

    interface WaitingView {
        UUID getTokenId();

        int getTicketNumber();

        String getPriority();

        long getIssuedEpoch();

        long getQueuePosition();

        UUID getVisitId();

        String getServiceStream();

        UUID getPatientId();

        String getFirstName();

        String getLastName();

        String getDateOfBirth();

        String getGender();

        String getTriageColour();
    }

    // The clinician's own confirmed appointments today at the facility, with
    // whether the patient has already been seen (a consultation signed today)
    // or is in today's queue (a token still waiting or called).
    @Query(value = "SELECT a.id AS \"appointmentId\", CAST(a.appointment_time AS VARCHAR) AS \"time\", "
            + "CAST(FLOOR(EXTRACT(EPOCH FROM a.starts_at)) AS BIGINT) AS \"startsEpoch\", p.id AS \"patientId\", "
            + "p.first_name AS \"firstName\", p.last_name AS \"lastName\", "
            + "EXISTS (SELECT 1 FROM consultations c JOIN visits v ON v.id = c.visit_id "
            + "WHERE v.patient_id = a.patient_id AND v.facility_id = a.facility_id "
            + "AND c.status IN ('SIGNED', 'SUPERSEDED') AND c.signed_at >= :dayStart AND c.signed_at < :dayEnd) "
            + "AS \"seen\", "
            + "EXISTS (SELECT 1 FROM queue_tokens qt JOIN visits v ON v.id = qt.visit_id "
            + "WHERE v.patient_id = a.patient_id AND qt.facility_id = a.facility_id "
            + "AND qt.status IN ('ISSUED', 'CALLED') AND qt.issued_at >= :dayStart AND qt.issued_at < :dayEnd) "
            + "AS \"inQueue\" "
            + "FROM appointments a JOIN patients p ON p.id = a.patient_id "
            + "WHERE a.facility_id = :facilityId AND a.assigned_staff_id = :staffId AND a.appointment_date = :day "
            + "AND a.status = 'CONFIRMED' ORDER BY a.appointment_time, a.id", nativeQuery = true)
    List<AppointmentView> appointments(@Param("facilityId") UUID facilityId, @Param("staffId") UUID staffId,
                                       @Param("day") LocalDate day, @Param("dayStart") Instant dayStart,
                                       @Param("dayEnd") Instant dayEnd);

    interface AppointmentView {
        UUID getAppointmentId();

        String getTime();

        long getStartsEpoch();

        UUID getPatientId();

        String getFirstName();

        String getLastName();

        boolean getSeen();

        boolean getInQueue();
    }

    // Messages other staff (the pharmacy) sent about prescriptions this
    // clinician wrote at the facility, newest first.
    @Query(value = "SELECT pm.id AS \"messageId\", pr.id AS \"prescriptionId\", pr.serial_number AS \"serialNumber\", "
            + "p.id AS \"patientId\", p.first_name AS \"patientFirstName\", p.last_name AS \"patientLastName\", "
            + "pm.message AS \"message\", "
            + "COALESCE(u.first_name || ' ' || u.last_name, '') AS \"senderName\", "
            + "CAST(FLOOR(EXTRACT(EPOCH FROM pm.sent_at)) AS BIGINT) AS \"sentEpoch\" "
            + "FROM prescriber_messages pm JOIN prescriptions pr ON pr.id = pm.prescription_id "
            + "JOIN patients p ON p.id = pr.patient_id LEFT JOIN users u ON u.id = pm.sender_user_id "
            + "WHERE pr.facility_id = :facilityId AND pr.prescriber_id = :staffId "
            + "AND pm.sender_user_id <> :staffId AND pm.sent_at >= :since "
            + "ORDER BY pm.sent_at DESC, pm.id LIMIT :limit", nativeQuery = true)
    List<MessageView> pharmacyMessages(@Param("facilityId") UUID facilityId, @Param("staffId") UUID staffId,
                                       @Param("since") Instant since, @Param("limit") int limit);

    interface MessageView {
        UUID getMessageId();

        UUID getPrescriptionId();

        String getSerialNumber();

        UUID getPatientId();

        String getPatientFirstName();

        String getPatientLastName();

        String getMessage();

        String getSenderName();

        long getSentEpoch();
    }

    // Visits this clinician signed a consultation for, counted once each on
    // the facility-local day of the first signature: an amendment or a
    // continued consultation is the same patient, not a second one; entries
    // marked entered-in-error never count.
    @Query(value = "SELECT CAST(CAST(firsts.first_signed AT TIME ZONE CAST(:zone AS TEXT) AS DATE) AS VARCHAR) "
            + "AS \"day\", COUNT(*) AS \"count\" FROM ("
            + "SELECT c.visit_id AS visit_id, MIN(c.signed_at) AS first_signed "
            + "FROM consultations c JOIN visits v ON v.id = c.visit_id "
            + "WHERE v.facility_id = :facilityId AND c.signed_by_user_id = :staffId "
            + "AND c.status <> 'ENTERED_IN_ERROR' AND c.signed_at IS NOT NULL GROUP BY c.visit_id) firsts "
            + "WHERE firsts.first_signed >= :from AND firsts.first_signed < :to GROUP BY 1", nativeQuery = true)
    List<DayCountView> seenPerDay(@Param("facilityId") UUID facilityId, @Param("staffId") UUID staffId,
                                  @Param("zone") String zone, @Param("from") Instant from, @Param("to") Instant to);

    interface DayCountView {
        String getDay();

        long getCount();
    }
}
