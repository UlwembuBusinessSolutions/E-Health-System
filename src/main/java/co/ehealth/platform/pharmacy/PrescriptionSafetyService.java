package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.*;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.*;
import java.util.*;

@Service
public class PrescriptionSafetyService {
    private final PrescriptionSupplyRepository supplies;
    private final PrescriptionRepository prescriptions;
    private final PrescriptionItemRepository items;
    private final FacilityRepository facilities;
    private final PermissionService permissions;
    private final StaffService staff;
    private final UserRepository users;
    private final OrganizationRepository organizations;
    private final PrescriberMessageRepository messages;
    private final EmailService email;
    private final AuditLogService audit;
    private final Clock clock;
    private final co.ehealth.platform.patient.PatientRepository patients;

    public PrescriptionSafetyService(PrescriptionSupplyRepository supplies, PrescriptionRepository prescriptions,
            PrescriptionItemRepository items, FacilityRepository facilities, PermissionService permissions,
            StaffService staff, UserRepository users, OrganizationRepository organizations,
            PrescriberMessageRepository messages, EmailService email, AuditLogService audit, Clock clock,
            co.ehealth.platform.patient.PatientRepository patients) {
        this.supplies = supplies; this.prescriptions = prescriptions; this.items = items;
        this.facilities = facilities; this.permissions = permissions; this.staff = staff; this.users = users;
        this.organizations = organizations; this.messages = messages; this.email = email; this.audit = audit;
        this.clock = clock;
        this.patients = patients;
    }

    public record SupplyWarning(UUID supplyId, UUID prescriptionItemId, Instant dispensedAt,
            UUID facilityId, String facilityName, LocalDate supplyUntil, int quantity) {}

    public List<SupplyWarning> warnings(Prescription p, PrescriptionItem item) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        if (item.getProductId() == null) return List.of();
        LocalDate today = today(p);
        var warnings = new ArrayList<>(supplies.findByPatientIdAndProductIdAndSupplyUntilGreaterThanEqualOrderByDispensedAtDesc(
                p.getPatientId(), item.getProductId(), today).stream()
                // Finishing the same item is a continuation, not another prescription.
                .filter(s -> !s.getPrescriptionItemId().equals(item.getId()))
                .map(s -> new SupplyWarning(s.getId(), s.getPrescriptionItemId(), s.getDispensedAt(),
                        s.getFacilityId(), facilities.findById(s.getFacilityId()).map(f -> f.getName()).orElse("Unknown clinic"),
                        s.getSupplyUntil(), s.getQuantity())).toList());
        supplies.findHistoricalSupplies(p.getPatientId(), item.getProductId(), item.getDrugName()).stream()
                .filter(s -> !s.getPrescriptionItemId().equals(item.getId()))
                .map(s -> new SupplyWarning(s.getPrescriptionItemId(), s.getPrescriptionItemId(), s.getDispensedAt(),
                        s.getFacilityId(), facilities.findById(s.getFacilityId()).map(f -> f.getName()).orElse("Unknown clinic"),
                        null, s.getQuantity())).forEach(warnings::add);
        return List.copyOf(warnings);
    }

    private LocalDate today(Prescription p) {
        var facility = facilities.findById(p.getFacilityId())
                .orElseThrow(co.ehealth.platform.facility.FacilityNotFoundException::new);
        return LocalDate.now(clock.withZone(ZoneId.of(facility.getTimezone())));
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void checkSupply(Prescription p, PrescriptionItem item, PrescriptionStockService.DispenseCommand command) {
        // Serialize supplies for this patient across prescriptions and clinics before checking history.
        patients.findForDispensingUpdate(p.getPatientId())
                .orElseThrow(co.ehealth.platform.patient.PatientNotFoundException::new);
        if (command == null || command.supplyUntil() == null || command.supplyUntil().isBefore(today(p)))
            throw new InvalidDispenseException("Record the supply end date, on or after the clinic's current date.");
        var warnings = warnings(p, item);
        if (!warnings.isEmpty() && (!command.acknowledgeDuplicateSupply()
                || warnings.stream().anyMatch(w -> !command.acknowledgedSupplyIds().contains(w.supplyId()))))
            throw new DuplicateSupplyException(warnings);
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void recordSupply(Prescription p, PrescriptionItem item, UUID actor,
                             PrescriptionStockService.DispenseCommand command) {
        supplies.save(new PrescriptionSupply(p, item, actor, clock.instant(), command.supplyUntil(), command.quantity()));
    }

    @Transactional
    public void decline(UUID prescriptionId, UUID itemId, UUID actor, DeclineReason reason, String note) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!staff.getLicenseStatus(actor).canDispense())
            throw new NotLicensedException("You need a current SAPC registration to decline dispensing.");
        var p = prescriptions.findForUpdate(prescriptionId).orElseThrow(PrescriptionNotFoundException::new);
        var item = items.findById(itemId).orElseThrow(PrescriptionItemNotFoundException::new);
        if (!item.getPrescriptionId().equals(p.getId())) throw new PrescriptionItemNotFoundException();
        var prescriber = users.findById(p.getPrescriberId()).orElseThrow(PrescriptionNotFoundException::new);
        var sender = users.findById(actor).orElseThrow(PrescriptionNotFoundException::new);
        var organization = organizations.findBySchemaName(TenantContext.getCurrentTenant())
                .orElseThrow(() -> new InvalidDispenseException("The prescribing organization could not be resolved."));
        if (prescriber.getEmail() == null || prescriber.getEmail().isBlank())
            throw new InvalidDispenseException("The prescriber needs an email address for decline notification.");
        var previousStatus = item.getStatus();
        item.decline(reason, note, actor, clock.instant());
        items.save(item);
        p.recomputeStatus(items.findByPrescriptionId(p.getId()));
        prescriptions.save(p);
        String message = "Dispensing declined for " + item.getDrugName() + " (item " + item.getId()
                + "). Reason: " + reason.name() + "."
                + (item.getDeclineNote() == null ? "" : " " + item.getDeclineNote())
                + " Previously supplied quantity: " + item.getDispensedQuantity() + ".";
        messages.save(new PrescriberMessage(p.getId(), actor, message, clock.instant()));
        // The durable message and decision commit together; never email a rolled-back decision.
        Runnable notify = () -> email.sendPrescriberDeclineEmail(prescriber.getEmail(), prescriber.getFirstName(),
                organization.getDisplayName(), sender.getFirstName() + " " + sender.getLastName(), p.getSerialNumber(), message);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { notify.run(); }
            });
        } else {
            notify.run();
        }
        var decision = new LinkedHashMap<String, Object>();
        decision.put("status", "DECLINED"); decision.put("reasonCode", reason.name());
        decision.put("note", item.getDeclineNote()); decision.put("dispensedQuantity", item.getDispensedQuantity());
        try {
            audit.append(actor, p.getFacilityId(), "PRESCRIPTION_ITEM_DECLINED", "PrescriptionItem", itemId.toString(),
                    "{\"status\":\"" + previousStatus.name() + "\"}", new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(decision));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new IllegalStateException("Could not serialize the decline audit record", ex);
        }
    }
}
