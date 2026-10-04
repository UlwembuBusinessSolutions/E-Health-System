package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.stock.PharmacyBatch;
import co.ehealth.platform.pharmacy.stock.PharmacyBatchRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService.EntryRequest;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLocationService;
import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// A patient bringing medicine back. Unopened or wrong-item units return to
// the shelf as a new ledger entry; damaged units are brought in and
// immediately written off, so the ledger shows the unit arriving and being
// wasted rather than silently vanishing. Every path is an append-only ledger
// entry — a return never edits the original dispense.
@Service
public class DispenseReturnService {

    private final DispensingGuard guard;
    private final ItemLock itemLock;
    private final DispenseAllocationRepository allocationRepository;
    private final PrescriptionReturnRepository returnRepository;
    private final ReturnPlanner returnPlanner;
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyStockLocationService locationService;
    private final PatientLedgerPoster ledgerPoster;
    private final ProductScheduleLookup scheduleLookup;
    private final ScheduleRegisterRecorder registerRecorder;
    private final PartyDirectory partyDirectory;
    private final AuditLogService auditLogService;
    private final Clock clock;

    public DispenseReturnService(DispensingGuard guard, ItemLock itemLock,
                                  DispenseAllocationRepository allocationRepository,
                                  PrescriptionReturnRepository returnRepository, ReturnPlanner returnPlanner,
                                  PharmacyBatchRepository batchRepository,
                                  PharmacyStockLocationService locationService, PatientLedgerPoster ledgerPoster,
                                  ProductScheduleLookup scheduleLookup, ScheduleRegisterRecorder registerRecorder,
                                  PartyDirectory partyDirectory, AuditLogService auditLogService, Clock clock) {
        this.guard = guard;
        this.itemLock = itemLock;
        this.allocationRepository = allocationRepository;
        this.returnRepository = returnRepository;
        this.returnPlanner = returnPlanner;
        this.batchRepository = batchRepository;
        this.locationService = locationService;
        this.ledgerPoster = ledgerPoster;
        this.scheduleLookup = scheduleLookup;
        this.registerRecorder = registerRecorder;
        this.partyDirectory = partyDirectory;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    public record ReturnCommand(int quantity, ReturnCondition condition, String reason) {
    }

    public record ReturnOutcome(UUID itemId, int quantity, ReturnCondition condition, boolean restocked,
                                int totalReturned, int stillReturnable) {
    }

    @Transactional
    public ReturnOutcome recordReturn(UUID prescriptionId, UUID itemId, ReturnCommand command, UUID staffId) {
        validate(command);
        DispensingActor actor = guard.requireDispenser(staffId);
        Prescription prescription = guard.loadPrescription(prescriptionId);
        PrescriptionItem item = itemLock.lockOwnedItem(prescription, itemId);

        List<DispenseAllocation> allocations = allocationRepository.findByPrescriptionItemIdOrderByCreatedAtAsc(itemId);
        if (allocations.isEmpty()) {
            throw new DispensingValidationException("This item was not dispensed from stock, so there is "
                    + "nothing to return to the shelf.");
        }
        List<PrescriptionReturn> earlierReturns = returnRepository.findByPrescriptionItemId(itemId);
        List<ReturnPlanner.LotReturn> lotReturns = returnPlanner.plan(allocations, earlierReturns,
                command.quantity());
        int returnedBefore = earlierReturns.stream().mapToInt(PrescriptionReturn::getQuantity).sum();
        int returnableBefore = returnPlanner.totalReturnable(allocations, earlierReturns);

        Map<UUID, PharmacyBatch> batches = batchRepository
                .findAllById(lotReturns.stream().map(ReturnPlanner.LotReturn::batchId).toList()).stream()
                .collect(Collectors.toMap(PharmacyBatch::getId, Function.identity()));
        PharmacyStockTransaction transaction = postStockMovement(prescription, item, lotReturns, batches, command,
                actor, returnedBefore);

        Instant now = clock.instant();
        returnRepository.saveAll(lotReturns.stream()
                .map(lotReturn -> new PrescriptionReturn(itemId, lotReturn.batchId(), lotReturn.quantity(),
                        command.condition(), command.reason().trim(), transaction.getId(), actor.userId(), now))
                .toList());
        recordScheduledReturn(prescription, lotReturns, batches, command, transaction, actor);
        auditLogService.append(actor.userId(), prescription.getFacilityId(), "PRESCRIPTION_ITEM_RETURNED",
                "PrescriptionItem", itemId.toString(), null,
                "quantity=" + command.quantity() + ";condition=" + command.condition());

        return new ReturnOutcome(itemId, command.quantity(), command.condition(), command.condition().isRestockable(),
                returnedBefore + command.quantity(), returnableBefore - command.quantity());
    }

    private void validate(ReturnCommand command) {
        if (command.quantity() < 1) {
            throw new DispensingValidationException("Enter how many units are being returned.");
        }
        if (command.condition() == null) {
            throw new DispensingValidationException("Say whether the returned medicine is unopened, damaged "
                    + "or the wrong item.");
        }
        if (!StringUtils.hasText(command.reason())) {
            throw new DispensingValidationException("Give a reason for the return.");
        }
    }

    // The idempotency keys name the item and the quantity already returned
    // (the attempt), so a replayed request cannot move stock a second time.
    private PharmacyStockTransaction postStockMovement(Prescription prescription, PrescriptionItem item,
                                                        List<ReturnPlanner.LotReturn> lotReturns,
                                                        Map<UUID, PharmacyBatch> batches, ReturnCommand command,
                                                        DispensingActor actor, int returnedBefore) {
        UUID locationId = locationService.getOrCreateMainLocation(prescription.getFacilityId()).getId();
        String keyPrefix = "return:" + item.getId() + ":" + returnedBefore;
        String reason = "Returned (" + command.condition() + "): " + command.reason().trim();

        PharmacyStockTransaction backIn = ledgerPoster.post(StockTransactionType.ADJUSTMENT_POSITIVE, prescription,
                actor, reason, keyPrefix + ":in", entries(lotReturns, batches, locationId, 1));
        if (command.condition().isRestockable()) {
            return backIn;
        }
        return ledgerPoster.post(StockTransactionType.WRITE_OFF, prescription, actor, reason, keyPrefix + ":waste",
                entries(lotReturns, batches, locationId, -1));
    }

    private List<EntryRequest> entries(List<ReturnPlanner.LotReturn> lotReturns, Map<UUID, PharmacyBatch> batches,
                                       UUID locationId, int direction) {
        return lotReturns.stream()
                .map(lotReturn -> new EntryRequest(batches.get(lotReturn.batchId()).getProductId(),
                        lotReturn.batchId(), locationId, StockBucket.AVAILABLE, direction * lotReturn.quantity()))
                .toList();
    }

    // Every return of a Schedule 5/6 product is registered, including a
    // damaged one — the register must account for the unit coming back.
    private void recordScheduledReturn(Prescription prescription, List<ReturnPlanner.LotReturn> lotReturns,
                                        Map<UUID, PharmacyBatch> batches, ReturnCommand command,
                                        PharmacyStockTransaction transaction, DispensingActor actor) {
        List<UUID> productIds = batches.values().stream().map(PharmacyBatch::getProductId).distinct().toList();
        Map<UUID, MedicineSchedule> scheduled = scheduleLookup.schedulesFor(productIds);
        if (scheduled.isEmpty()) {
            return;
        }
        Patient patient = partyDirectory.patients(List.of(prescription.getPatientId()))
                .get(prescription.getPatientId());
        for (ReturnPlanner.LotReturn lotReturn : lotReturns) {
            PharmacyBatch batch = batches.get(lotReturn.batchId());
            if (scheduled.containsKey(batch.getProductId())) {
                registerRecorder.recordReturn(new ScheduleRegisterRecorder.ReturnEntry(prescription.getFacilityId(),
                        batch.getProductId(), batch.getId(), batch.getLotNumber(), lotReturn.quantity(),
                        prescription.getSerialNumber(), prescription.getPatientId(), PartyDirectory.fullName(patient),
                        command.condition().isRestockable(), actor.userId(), actor.name(), transaction.getId(),
                        clock.instant()));
            }
        }
    }
}
