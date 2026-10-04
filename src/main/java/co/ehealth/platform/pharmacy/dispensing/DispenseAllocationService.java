package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.pharmacy.DispensingRecord;
import co.ehealth.platform.pharmacy.DispensingRecordRepository;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionAlreadyDispensedException;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.PrescriptionStatus;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService.EntryRequest;
import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Stock-backed dispensing of ONE prescription item. Everything that must be
// true together — the ledger deduction, the lot allocations, the item's new
// dispensed quantity, the dispensing record and the audit entry — happens in
// the caller's single transaction, so a failure anywhere leaves stock and
// prescription untouched (STK-11).
@Service
public class DispenseAllocationService {

    private final PrescriptionItemRepository itemRepository;
    private final ItemLock itemLock;
    private final DispensingRecordRepository dispensingRecordRepository;
    private final DispenseAllocationRepository allocationRepository;
    private final StockLotReader lotReader;
    private final FefoLotSelector lotSelector;
    private final SubstitutionLookup substitutionLookup;
    private final PatientLedgerPoster ledgerPoster;
    private final ProductScheduleLookup scheduleLookup;
    private final ScheduleRegisterRecorder registerRecorder;
    private final PartyDirectory partyDirectory;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public DispenseAllocationService(PrescriptionItemRepository itemRepository, ItemLock itemLock,
                                      DispensingRecordRepository dispensingRecordRepository,
                                      DispenseAllocationRepository allocationRepository, StockLotReader lotReader,
                                      FefoLotSelector lotSelector, SubstitutionLookup substitutionLookup,
                                      PatientLedgerPoster ledgerPoster, ProductScheduleLookup scheduleLookup,
                                      ScheduleRegisterRecorder registerRecorder, PartyDirectory partyDirectory,
                                      AuditLogService auditLogService, Clock clock) {
        this.itemRepository = itemRepository;
        this.itemLock = itemLock;
        this.dispensingRecordRepository = dispensingRecordRepository;
        this.allocationRepository = allocationRepository;
        this.lotReader = lotReader;
        this.lotSelector = lotSelector;
        this.substitutionLookup = substitutionLookup;
        this.ledgerPoster = ledgerPoster;
        this.scheduleLookup = scheduleLookup;
        this.registerRecorder = registerRecorder;
        this.partyDirectory = partyDirectory;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    // quantity null means "everything still remaining"; batchId null means
    // "first-expiring-first, never an expired lot".
    public record DispenseRequest(Integer quantity, UUID batchId) {
        public static DispenseRequest remaining() {
            return new DispenseRequest(null, null);
        }
    }

    public record DispenseOutcome(PrescriptionItem item, List<LotDraw> draws) {
        public int dispensedNow() {
            return draws.stream().mapToInt(LotDraw::quantity).sum();
        }
    }

    // Why this item cannot be handed over in full right now, or empty when
    // it can. Collection uses this to skip rather than fail an item.
    public Optional<SkipReason> findBlocker(Prescription prescription, PrescriptionItem item) {
        if (item.getStatus() == PrescriptionStatus.DISPENSED) {
            return Optional.of(SkipReason.NOT_PENDING);
        }
        UUID productId = substitutionLookup.dispensingProductId(item);
        if (productId == null) {
            return Optional.of(SkipReason.NOT_MAPPED);
        }
        long usable = lotReader.shelf(prescription.getFacilityId(), productId).usableTotal();
        if (usable == 0) {
            return Optional.of(SkipReason.NO_USABLE_STOCK);
        }
        return usable < item.getRemainingQuantity() ? Optional.of(SkipReason.INSUFFICIENT_STOCK) : Optional.empty();
    }

    // Locks the item row first so two pharmacists dispensing the same item
    // serialise instead of both succeeding; the ledger's own account locks
    // do the same for the last units of a lot.
    @Transactional
    public DispenseOutcome dispense(Prescription prescription, UUID itemId, DispenseRequest request,
                                     DispensingActor actor) {
        PrescriptionItem item = itemLock.lockOwnedItem(prescription, itemId);
        if (item.getStatus() == PrescriptionStatus.DISPENSED) {
            throw new PrescriptionAlreadyDispensedException();
        }
        UUID productId = requireProduct(item);
        int quantity = resolveQuantity(item, request.quantity());

        StockPicture shelf = lotReader.shelf(prescription.getFacilityId(), productId);
        List<LotDraw> draws = lotSelector.allocate(shelf, quantity, request.batchId());

        PharmacyStockTransaction transaction = deductStock(prescription, item, productId, draws, actor);
        recordAllocations(item, draws, transaction, actor);
        item.recordDispensed(quantity);
        itemRepository.save(item);
        if (item.getStatus() == PrescriptionStatus.DISPENSED) {
            dispensingRecordRepository.save(new DispensingRecord(item.getId(), actor.userId(), clock.instant()));
        }
        recordScheduledDispense(prescription, productId, draws, transaction, actor);
        auditLogService.append(actor.userId(), prescription.getFacilityId(), "PRESCRIPTION_ITEM_DISPENSED",
                "PrescriptionItem", item.getId().toString(), null,
                "quantity=" + quantity + ";remaining=" + item.getRemainingQuantity());
        return new DispenseOutcome(item, draws);
    }

    private UUID requireProduct(PrescriptionItem item) {
        UUID productId = substitutionLookup.dispensingProductId(item);
        if (productId == null) {
            throw new ProductNotMappedException(item.getDrugName());
        }
        return productId;
    }

    private int resolveQuantity(PrescriptionItem item, Integer requested) {
        int remaining = item.getRemainingQuantity();
        if (requested == null) {
            return remaining;
        }
        if (requested < 1 || requested > remaining) {
            throw new DispensingValidationException("Enter a quantity between 1 and " + remaining
                    + " (the amount still to dispense).");
        }
        return requested;
    }

    // The idempotency key names the item and how much was already dispensed,
    // i.e. the attempt: replaying the same request returns the original
    // transaction, while the next partial dispense gets a fresh key.
    private PharmacyStockTransaction deductStock(Prescription prescription, PrescriptionItem item, UUID productId,
                                                  List<LotDraw> draws, DispensingActor actor) {
        List<EntryRequest> entries = draws.stream()
                .map(draw -> new EntryRequest(productId, draw.lot().batchId(), draw.lot().locationId(),
                        StockBucket.AVAILABLE, -draw.quantity()))
                .toList();
        String idempotencyKey = "dispense:" + item.getId() + ":" + item.getDispensedQuantity();
        return ledgerPoster.post(StockTransactionType.DISPENSE, prescription, actor,
                "Dispensed against " + prescription.getSerialNumber(), idempotencyKey, entries);
    }

    private void recordAllocations(PrescriptionItem item, List<LotDraw> draws, PharmacyStockTransaction transaction,
                                    DispensingActor actor) {
        Instant now = clock.instant();
        allocationRepository.saveAll(draws.stream()
                .map(draw -> new DispenseAllocation(item.getId(), draw.lot().batchId(), draw.quantity(),
                        transaction.getId(), actor.userId(), now))
                .toList());
    }

    // Schedule 5/6 medicines get a register entry per lot, inside this same
    // transaction. Skipped entirely for ordinary products so they never pay
    // for the patient/prescriber lookups.
    private void recordScheduledDispense(Prescription prescription, UUID productId, List<LotDraw> draws,
                                          PharmacyStockTransaction transaction, DispensingActor actor) {
        if (!scheduleLookup.schedulesFor(List.of(productId)).containsKey(productId)) {
            return;
        }
        String patientName = PartyDirectory.fullName(partyDirectory.patients(List.of(prescription.getPatientId()))
                .get(prescription.getPatientId()));
        User prescriber = partyDirectory.users(List.of(prescription.getPrescriberId()))
                .get(prescription.getPrescriberId());
        for (LotDraw draw : draws) {
            registerRecorder.recordDispense(prescription.getFacilityId(), productId,
                    prescription.getSerialNumber(), patientName, prescription.getPatientId().toString(),
                    prescriber == null ? null : PartyDirectory.fullName(prescriber),
                    prescriber == null ? null : PartyDirectory.registrationNumber(prescriber), draw.quantity(),
                    draw.lot().lotNumber(), actor.userId(), transaction.getId());
        }
    }
}
