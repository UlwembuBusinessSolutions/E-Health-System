package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class PrescriptionQueryService {
    private final PrescriptionRepository prescriptions;
    private final PrescriptionItemRepository items;
    private final PrescriptionQueryRepository queries;
    private final PrescriptionQueryNotificationRepository notifications;
    private final ClinicalSafetyService clinicalSafety;
    private final PermissionService permissions;
    private final AuditLogService audit;
    private final Clock clock;
    private final PrescriptionQueryLiveNotifier liveNotifier;

    public PrescriptionQueryService(PrescriptionRepository prescriptions, PrescriptionItemRepository items,
            PrescriptionQueryRepository queries, PrescriptionQueryNotificationRepository notifications,
            ClinicalSafetyService clinicalSafety, PermissionService permissions, AuditLogService audit, Clock clock,
            PrescriptionQueryLiveNotifier liveNotifier) {
        this.prescriptions = prescriptions; this.items = items; this.queries = queries; this.notifications = notifications;
        this.clinicalSafety = clinicalSafety; this.permissions = permissions; this.audit = audit; this.clock = clock;
        this.liveNotifier = liveNotifier;
    }

    /** Preview allows the pharmacy screen to show a deviation before the query is submitted. */
    public List<ClinicalSafetyAlert> preview(UUID prescriptionId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        Prescription prescription = prescription(prescriptionId);
        return clinicalSafety.check(prescription.getPatientId(), items.findByPrescriptionId(prescriptionId).stream().map(PrescriptionItem::getDrugName).toList());
    }

    @Transactional
    public PrescriptionQuery raise(UUID prescriptionId, String reason, UUID pharmacistId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        Prescription prescription = prescription(prescriptionId);
        if (prescription.getStatus() == PrescriptionStatus.DISPENSED || prescription.getStatus() == PrescriptionStatus.DECLINED) throw new PrescriptionAlreadyDispensedException();
        if (prescription.getStatus() == PrescriptionStatus.HELD) throw new PrescriptionOnHoldException();
        List<ClinicalSafetyAlert> alerts = previewFor(prescription);
        String warning = alerts.isEmpty() ? null : alerts.stream().map(ClinicalSafetyAlert::message).distinct().reduce((a, b) -> a + " | " + b).orElse(null);
        Instant now = clock.instant();
        PrescriptionQuery query = queries.save(new PrescriptionQuery(prescriptionId, prescription.getFacilityId(), pharmacistId,
                prescription.getPrescriberId(), reason.trim(), warning, now));
        prescription.hold();
        prescriptions.save(prescription);
        PrescriptionQueryNotification notification = notifications.save(new PrescriptionQueryNotification(query.getId(), prescription.getPrescriberId(), "QUERY_RAISED",
                "A pharmacist has queried prescription " + prescription.getSerialNumber() + ".", now));
        liveNotifier.publish(notification);
        audit.append(pharmacistId, prescription.getFacilityId(), "PRESCRIPTION_QUERY_RAISED", "PrescriptionQuery", query.getId().toString(), null,
                "{\"prescriptionId\":\"" + prescriptionId + "\",\"guidelineWarning\":" + json(warning) + "}");
        return query;
    }

    @Transactional
    public PrescriptionQuery respond(UUID queryId, String response, UUID prescriberId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        PrescriptionQuery query = queries.findByIdAndFacilityId(queryId, ClinicContext.require()).orElseThrow(PrescriptionQueryNotFoundException::new);
        if (!query.getPrescriberId().equals(prescriberId)) throw new PrescriptionQueryResponseForbiddenException();
        if (query.getStatus() == PrescriptionQueryStatus.RESPONDED) return query;
        Prescription prescription = prescription(query.getPrescriptionId());
        Instant now = clock.instant();
        query.respond(response.trim(), now);
        queries.save(query);
        prescription.returnToQueue();
        prescriptions.save(prescription);
        PrescriptionQueryNotification notification = notifications.save(new PrescriptionQueryNotification(query.getId(), query.getRaisedByUserId(), "QUERY_RESPONDED",
                "The prescriber has responded to your query for prescription " + prescription.getSerialNumber() + ".", now));
        liveNotifier.publish(notification);
        audit.append(prescriberId, prescription.getFacilityId(), "PRESCRIPTION_QUERY_RESPONDED", "PrescriptionQuery", queryId.toString(), null, null);
        return query;
    }

    public List<PrescriptionQuery> list() { permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW); return queries.findByFacilityIdOrderByRaisedAtDesc(ClinicContext.require()); }
    public List<PrescriptionQueryNotification> notifications(UUID userId) { permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW); return notifications.findByRecipientUserIdOrderByCreatedAtDesc(userId); }
    private Prescription prescription(UUID id) { return prescriptions.findByIdAndFacilityId(id, ClinicContext.require()).orElseThrow(PrescriptionNotFoundException::new); }
    private List<ClinicalSafetyAlert> previewFor(Prescription p) { return clinicalSafety.check(p.getPatientId(), items.findByPrescriptionId(p.getId()).stream().map(PrescriptionItem::getDrugName).toList()); }
    private String json(String value) { return value == null ? "null" : "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
}
