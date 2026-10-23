package co.ehealth.platform.pharmacy.ccmdd;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionRepository;
import co.ehealth.platform.pharmacy.PrescriptionStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.util.*;

@Service
public class CcmddParcelService {
    private final CcmddParcelRepository parcels;
    private final CcmddPickupPointRepository points;
    private final PrescriptionRepository prescriptions;
    private final PatientRepository patients;
    private final AuditLogService audit;
    private final EmailService email;
    private final Clock clock;
    private final int defaultTracingDays;

    public CcmddParcelService(CcmddParcelRepository parcels, CcmddPickupPointRepository points,
                              PrescriptionRepository prescriptions, PatientRepository patients,
                              AuditLogService audit, EmailService email, Clock clock,
                              @Value("${app.ccmdd.tracing-days:7}") int defaultTracingDays) {
        this.parcels = parcels; this.points = points; this.prescriptions = prescriptions;
        this.patients = patients; this.audit = audit; this.email = email; this.clock = clock;
        this.defaultTracingDays = defaultTracingDays;
    }

    public int defaultTracingDays() { return defaultTracingDays; }

    @Transactional(readOnly=true)
    public List<ParcelView> list(UUID facilityId, boolean tracingOnly) {
        Instant now = clock.instant();
        List<CcmddParcel> rows = tracingOnly
                ? parcels.findByFacilityIdAndStatusInAndTraceDueAtLessThanEqualOrderByTraceDueAtAsc(
                      facilityId, List.of("DISPATCHED", "READY"), now)
                : parcels.findByFacilityIdOrderByDispatchedAtDesc(facilityId);
        return rows.stream().map(p -> toView(p, now)).toList();
    }

    @Transactional
    public ParcelView dispatch(UUID facilityId, String serialNumber, UUID pickupPointId,
                               Integer tracingDays, UUID staffId) {
        if (serialNumber == null || serialNumber.isBlank()) bad("Prescription serial is required");
        int days = tracingDays == null ? defaultTracingDays : tracingDays;
        if (days < 1 || days > 90) bad("Tracing period must be between 1 and 90 days");
        Prescription rx = prescriptions.findBySerialNumber(serialNumber.trim()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Prescription not found"));
        if (!rx.getFacilityId().equals(facilityId)) bad("Prescription does not belong to selected facility");
        if (rx.getStatus() != PrescriptionStatus.DISPENSED) bad("Prescription must be fully dispensed before dispatch");
        if (parcels.existsByPrescriptionId(rx.getId())) conflict("This prescription already has a CCMDD parcel");
        CcmddPickupPoint point = points.findById(pickupPointId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pick-up point not found"));
        if (!point.isActive()) bad("Pick-up point is no longer in the active SYNCH directory");
        Instant now = clock.instant();
        CcmddParcel parcel = parcels.saveAndFlush(new CcmddParcel(rx.getId(), facilityId, rx.getPatientId(),
                point, days, staffId, now));
        notifyPoint(parcel, "DISPATCHED", now);
        audit.append(staffId, facilityId, "CCMDD_PARCEL_DISPATCHED", "CcmddParcel", parcel.getId().toString(),
                null, parcel.getTrackingReference());
        return toView(parcel, now);
    }

    @Transactional
    public ParcelView updateStatus(UUID parcelId, UUID facilityId, String targetStatus, UUID staffId) {
        CcmddParcel p = getLockedAtFacility(parcelId, facilityId);
        Instant now = clock.instant();
        String before = p.getStatus();
        switch (targetStatus == null ? "" : targetStatus) {
            case "READY" -> {
                if (!"DISPATCHED".equals(before)) conflict("Only dispatched parcels can be marked ready");
                p.ready(now);
                notifyPoint(p, "READY", now);
            }
            case "COLLECTED" -> {
                if (!List.of("DISPATCHED", "READY").contains(before)) conflict("Parcel is already closed");
                p.collected(now);
            }
            case "RETURNED" -> {
                if (!List.of("DISPATCHED", "READY").contains(before)) conflict("Parcel is already closed");
                p.returned(now);
            }
            default -> bad("Status must be READY, COLLECTED or RETURNED");
        }
        audit.append(staffId, facilityId, "CCMDD_PARCEL_" + p.getStatus(), "CcmddParcel", p.getId().toString(),
                before, p.getStatus());
        return toView(p, now);
    }

    @Transactional
    public ParcelView recordTrace(UUID parcelId, UUID facilityId, String note, UUID staffId) {
        CcmddParcel p = getLockedAtFacility(parcelId, facilityId);
        Instant now = clock.instant();
        if (!List.of("DISPATCHED", "READY").contains(p.getStatus()) || p.getTraceDueAt().isAfter(now)) {
            conflict("Only overdue, uncollected parcels can be traced");
        }
        if (note == null || note.isBlank() || note.trim().length() > 1000) bad("Provide a tracing note (maximum 1000 characters)");
        p.traced(note.trim(), now);
        audit.append(staffId, facilityId, "CCMDD_PARCEL_TRACED", "CcmddParcel", p.getId().toString(),
                null, "Tracing attempt " + p.getTraceAttempts());
        return toView(p, now);
    }

    @Transactional
    public ParcelView retryNotification(UUID parcelId, UUID facilityId, UUID staffId) {
        CcmddParcel p = getLockedAtFacility(parcelId, facilityId);
        if (!List.of("DISPATCHED", "READY").contains(p.getStatus())) conflict("Only open parcels can be notified");
        notifyPoint(p, p.getStatus(), clock.instant());
        audit.append(staffId, facilityId, "CCMDD_NOTIFICATION_REQUEUED", "CcmddParcel", p.getId().toString(),
                null, p.getNotificationStatus());
        return toView(p, clock.instant());
    }

    private void notifyPoint(CcmddParcel parcel, String state, Instant now) {
        String contact = parcel.getPickupPoint().getContactEmail();
        if (contact == null || contact.isBlank()) {
            parcel.notificationMissing(); // UI explicitly shows NOT_CONFIGURED
            return;
        }
        try {
            email.sendCcmddPickupPointDispatchEmail(contact, parcel.getPickupPoint().getName(),
                    parcel.getTrackingReference(), state);
            parcel.notificationQueued(now); // email is queued, not delivery-verified
        } catch (Exception ex) {
            parcel.notificationFailed("Notification could not be queued");
        }
    }

    private CcmddParcel getLockedAtFacility(UUID id, UUID facilityId) {
        CcmddParcel p = parcels.findLockedById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found"));
        if (!p.getFacilityId().equals(facilityId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found");
        return p;
    }
    private ParcelView toView(CcmddParcel p, Instant now) {
        Patient patient = patients.findById(p.getPatientId()).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Patient not found"));
        boolean overdue = List.of("DISPATCHED", "READY").contains(p.getStatus()) && !p.getTraceDueAt().isAfter(now);
        return new ParcelView(p.getId(), p.getTrackingReference(), p.getPrescriptionId(), p.getFacilityId(),
                patient.getFirstName() + " " + patient.getLastName(), patient.getMpiNumber(), patient.getContactNumber(),
                CcmddDirectoryService.PointView.from(p.getPickupPoint()), p.getStatus(), p.getDispatchedAt(),
                p.getReadyAt(), p.getCollectedAt(), p.getReturnedAt(), p.getTraceDueAt(), p.getTracingDays(),
                p.getNotificationStatus(), p.getNotifiedAt(), p.getNotificationError(), overdue,
                p.getTraceAttempts(), p.getLastTracedAt(), p.getTraceNote());
    }
    private static void bad(String reason) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, reason); }
    private static void conflict(String reason) { throw new ResponseStatusException(HttpStatus.CONFLICT, reason); }

    public record ParcelView(UUID id, String trackingReference, UUID prescriptionId, UUID facilityId,
                             String patientName, String patientMpi, String patientContact, CcmddDirectoryService.PointView pickupPoint,
                             String status, Instant dispatchedAt, Instant readyAt, Instant collectedAt,
                             Instant returnedAt, Instant traceDueAt, int tracingDays, String notificationStatus,
                             Instant notifiedAt, String notificationError, boolean overdue,
                             int traceAttempts, Instant lastTracedAt, String traceNote) {}
}
