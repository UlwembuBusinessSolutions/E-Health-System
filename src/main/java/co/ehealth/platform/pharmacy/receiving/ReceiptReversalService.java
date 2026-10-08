package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.pharmacy.serial.SerialUnitService;
import co.ehealth.platform.pharmacy.stock.PharmacyReceipt;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptLine;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptLineRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntry;
import co.ehealth.platform.pharmacy.stock.PharmacyStockEntryRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import co.ehealth.platform.pharmacy.stock.ReceiptReversedEvent;
import co.ehealth.platform.pharmacy.stock.StockIntakeEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Reverses a whole receipt: stock back off the shelf, serial units retired,
// receipt marked REVERSED — one transaction, so a refusal part way (stock
// already used) leaves nothing half undone.
@Service
public class ReceiptReversalService {

    private final PharmacyReceiptRepository receiptRepository;
    private final ReceiptStockReverser stockReverser;
    private final SerialUnitService serialUnitService;
    private final PharmacyStockEntryRepository stockEntryRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private final PharmacyReceiptLineRepository receiptLineRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    public ReceiptReversalService(PharmacyReceiptRepository receiptRepository, ReceiptStockReverser stockReverser,
                                  SerialUnitService serialUnitService,
                                  PharmacyStockEntryRepository stockEntryRepository,
                                  AuditLogService auditLogService, ObjectMapper objectMapper,
                                  PharmacyReceiptLineRepository receiptLineRepository,
                                  ApplicationEventPublisher eventPublisher, Clock clock) {
        this.receiptLineRepository = receiptLineRepository;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
        this.receiptRepository = receiptRepository;
        this.stockReverser = stockReverser;
        this.serialUnitService = serialUnitService;
        this.stockEntryRepository = stockEntryRepository;
        this.auditLogService = auditLogService;
        this.clock = clock;
    }

    @Transactional
    public PharmacyReceipt reverse(UUID receiptId, String reason, UUID actorUserId, String actorName) {
        PharmacyReceipt receipt = receiptRepository.findByIdForUpdate(receiptId)
                .orElseThrow(ReceiptNotFoundException::new);
        if (receipt.isReversed()) {
            throw new ReceiptAlreadyReversedException(receipt.getReceiptNumber());
        }

        PharmacyStockTransaction reversal = stockReverser.reverse(receipt, reason, actorUserId, actorName);
        retireSerialUnits(receipt, reversal);
        publishReversal(receipt, reversal, reason, actorUserId);
        receipt.markReversed(reversal.getId(), actorName, clock.instant());
        receiptRepository.save(receipt);

        auditLogService.append(actorUserId, receipt.getFacilityId(), "STOCK_RECEIPT_REVERSED", "PharmacyReceipt",
                receipt.getId().toString(), null, auditPayload(reason));
        return receipt;
    }

    // Lets listeners (the scheduled-medicines register) react to the stock that left.
    private void publishReversal(PharmacyReceipt receipt, PharmacyStockTransaction reversal, String reason,
                                 UUID actorUserId) {
        List<StockIntakeEvent.IntakeLot> lots = receiptLineRepository.findByReceiptId(receipt.getId()).stream()
                .filter(line -> line.getBaseQuantity() > 0)
                .map(line -> new StockIntakeEvent.IntakeLot(line.getProductId(), line.getLotNumber(),
                        line.getBaseQuantity()))
                .toList();
        eventPublisher.publishEvent(new ReceiptReversedEvent(receipt.getFacilityId(), actorUserId,
                reversal.getId(), reason, lots));
    }

    private record ReversalAudit(String reason) {
    }

    // audit_log.after_value is JSONB, so the reason travels as a JSON object.
    private String auditPayload(String reason) {
        try {
            return objectMapper.writeValueAsString(new ReversalAudit(reason));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialise the receipt reversal audit entry", e);
        }
    }

    // Each serial unit left the shelf through the reversal entry on the same
    // stock account its receiving entry landed on.
    private void retireSerialUnits(PharmacyReceipt receipt, PharmacyStockTransaction reversal) {
        Map<UUID, UUID> reversalEntryIdByAccountId = stockEntryRepository.findByTransactionId(reversal.getId())
                .stream().collect(Collectors.toMap(PharmacyStockEntry::getStockAccountId, PharmacyStockEntry::getId,
                        (first, ignored) -> first));
        Map<UUID, UUID> reversalEntryIdByReceivedEntryId = new HashMap<>();
        for (PharmacyStockEntry received : stockEntryRepository.findByTransactionId(receipt.getTransactionId())) {
            reversalEntryIdByReceivedEntryId.put(received.getId(),
                    reversalEntryIdByAccountId.get(received.getStockAccountId()));
        }
        serialUnitService.removeSerialsReceivedWith(reversalEntryIdByReceivedEntryId);
    }
}
