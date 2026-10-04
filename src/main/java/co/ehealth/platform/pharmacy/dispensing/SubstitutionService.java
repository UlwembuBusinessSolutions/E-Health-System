package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionService;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductNotFoundException;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.ProductArchivedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

// Asking the prescriber to allow a different product for one item, and
// recording their answer. The question goes out through the existing
// prescriber-message mechanism (a real email plus a saved thread entry); the
// answer is recorded by the pharmacist when the prescriber replies. Nothing
// here dispenses anything: a substitute only becomes the dispensing product
// once APPROVED (SubstitutionLookup).
@Service
public class SubstitutionService {

    private final DispensingGuard guard;
    private final ItemLock itemLock;
    private final PrescriptionSubstitutionRepository substitutionRepository;
    private final PharmacyProductRepository productRepository;
    private final PrescriptionService prescriptionService;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public SubstitutionService(DispensingGuard guard, ItemLock itemLock,
                                PrescriptionSubstitutionRepository substitutionRepository,
                                PharmacyProductRepository productRepository,
                                PrescriptionService prescriptionService, AuditLogService auditLogService,
                                Clock clock) {
        this.guard = guard;
        this.itemLock = itemLock;
        this.substitutionRepository = substitutionRepository;
        this.productRepository = productRepository;
        this.prescriptionService = prescriptionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    public record SubstitutionView(UUID id, UUID itemId, UUID substituteProductId, String substituteProductName,
                                   SubstitutionStatus status, Instant requestedAt, Instant decidedAt, String note) {
    }

    @Transactional
    public SubstitutionView request(UUID prescriptionId, UUID itemId, UUID substituteProductId, String note,
                                     UUID staffId) {
        DispensingActor actor = guard.requireManager(staffId);
        Prescription prescription = guard.loadPrescription(prescriptionId);
        PrescriptionItem item = itemLock.lockOwnedItem(prescription, itemId);
        PharmacyProduct substitute = requireUsableSubstitute(item, substituteProductId);
        rejectIfAlreadyAwaitingAnswer(itemId);

        PrescriptionSubstitution saved = substitutionRepository.save(
                new PrescriptionSubstitution(itemId, substituteProductId, actor.userId(), clock.instant()));
        prescriptionService.sendPrescriberMessage(prescriptionId, staffId,
                requestMessage(prescription, item, substitute, note));
        auditLogService.append(actor.userId(), prescription.getFacilityId(), "PRESCRIPTION_SUBSTITUTION_REQUESTED",
                "PrescriptionItem", itemId.toString(), null, substitute.getCode());
        return view(saved, substitute);
    }

    @Transactional
    public SubstitutionView decide(UUID prescriptionId, UUID itemId, SubstitutionStatus decision, String note,
                                    UUID staffId) {
        if (decision != SubstitutionStatus.APPROVED && decision != SubstitutionStatus.REJECTED) {
            throw new DispensingValidationException("Record the prescriber's answer as APPROVED or REJECTED.");
        }
        DispensingActor actor = guard.requireManager(staffId);
        Prescription prescription = guard.loadPrescription(prescriptionId);
        itemLock.lockOwnedItem(prescription, itemId);

        PrescriptionSubstitution pending = substitutionRepository
                .findFirstByPrescriptionItemIdOrderByRequestedAtDesc(itemId)
                .filter(substitution -> substitution.getStatus() == SubstitutionStatus.REQUESTED)
                .orElseThrow(() -> new DispensingConflictException(
                        "There is no substitution waiting for the prescriber's answer on this item."));
        pending.decide(decision, actor.userId(), clock.instant(), StringUtils.hasText(note) ? note.trim() : null);
        substitutionRepository.save(pending);
        auditLogService.append(actor.userId(), prescription.getFacilityId(),
                "PRESCRIPTION_SUBSTITUTION_" + decision, "PrescriptionItem", itemId.toString(), null, null);
        return view(pending, productRepository.findById(pending.getSubstituteProductId()).orElseThrow());
    }

    private PharmacyProduct requireUsableSubstitute(PrescriptionItem item, UUID substituteProductId) {
        if (item.getRemainingQuantity() == 0) {
            throw new DispensingConflictException("This item has already been fully dispensed.");
        }
        PharmacyProduct substitute = productRepository.findById(substituteProductId)
                .orElseThrow(PharmacyProductNotFoundException::new);
        if (!substitute.isActive()) {
            throw new ProductArchivedException();
        }
        if (substituteProductId.equals(item.getProductId())) {
            throw new DispensingValidationException("Choose a different product from the one already selected "
                    + "for this item.");
        }
        return substitute;
    }

    private void rejectIfAlreadyAwaitingAnswer(UUID itemId) {
        boolean awaitingAnswer = substitutionRepository.findFirstByPrescriptionItemIdOrderByRequestedAtDesc(itemId)
                .filter(existing -> existing.getStatus() == SubstitutionStatus.REQUESTED).isPresent();
        if (awaitingAnswer) {
            throw new DispensingConflictException("A substitution is already waiting for the prescriber's answer "
                    + "on this item.");
        }
    }

    private String requestMessage(Prescription prescription, PrescriptionItem item, PharmacyProduct substitute,
                                  String note) {
        String message = "Substitution request for " + prescription.getSerialNumber() + ": \""
                + item.getDrugName() + "\" (" + item.getDosage() + ") is not available as prescribed. "
                + "May we dispense " + substitute.getDisplayName() + " instead? Please reply to confirm.";
        return StringUtils.hasText(note) ? message + " Note: " + note.trim() : message;
    }

    private SubstitutionView view(PrescriptionSubstitution substitution, PharmacyProduct substitute) {
        return new SubstitutionView(substitution.getId(), substitution.getPrescriptionItemId(), substitute.getId(),
                substitute.getDisplayName(), substitution.getStatus(), substitution.getRequestedAt(),
                substitution.getDecidedAt(), substitution.getNote());
    }
}
