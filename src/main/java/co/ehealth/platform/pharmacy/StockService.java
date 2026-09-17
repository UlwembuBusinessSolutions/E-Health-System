package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class StockService {

    private final StockBatchRepository stockBatchRepository;
    private final StockMovementRepository stockMovementRepository;
    private final StockReorderLevelRepository stockReorderLevelRepository;
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final int warningWindowDays;

    public StockService(StockBatchRepository stockBatchRepository, StockMovementRepository stockMovementRepository,
                        StockReorderLevelRepository stockReorderLevelRepository, PermissionService permissionService,
                        AuditLogService auditLogService, Clock clock,
                        @Value("${app.pharmacy.expiry-warning-days:90}") int warningWindowDays) {
        this.stockBatchRepository = stockBatchRepository;
        this.stockMovementRepository = stockMovementRepository;
        this.stockReorderLevelRepository = stockReorderLevelRepository;
        this.permissionService = permissionService;
        this.auditLogService = auditLogService;
        this.clock = clock;
        this.warningWindowDays = warningWindowDays;
    }

    @Transactional
    public StockBatch receive(ReceiveStockCommand command, UUID userId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        if (!command.expiryDate().isAfter(LocalDate.now(clock))) {
            throw new IllegalArgumentException("Stock expiry date must be in the future.");
        }
        StockBatch batch = stockBatchRepository.save(new StockBatch(command.facilityId(), command.drugName(),
                command.batchNumber(), command.barcode(), command.expiryDate(), command.quantity()));
        auditLogService.append(userId, command.facilityId(), "STOCK_RECEIVED", "StockBatch",
                batch.getId().toString(), null, "{\"quantity\":" + command.quantity() + "}");
        stockMovementRepository.save(new StockMovement(command.facilityId(), command.drugName(), batch.getId(),
                StockMovementType.RECEIPT, command.quantity(), 0, command.quantity(), batch.getId().toString(),
                userId, clock.instant()));
        return batch;
    }

    public List<StockBatch> expiryWarnings(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        LocalDate today = LocalDate.now(clock);
        return stockBatchRepository.findByFacilityIdAndExpiryDateBetweenAndQuantityOnHandGreaterThan(
                facilityId, today, today.plusDays(warningWindowDays), 0);
    }

    @Transactional
    public StockBatch writeOff(UUID batchId, int quantity, String reason, UUID userId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        StockBatch batch = stockBatchRepository.findById(batchId).orElseThrow(
                () -> new StockBatchNotFoundException(batchId.toString()));
        int before = batch.getQuantityOnHand();
        batch.removeQuantity(quantity);
        stockBatchRepository.save(batch);
        auditLogService.append(userId, batch.getFacilityId(), "STOCK_WRITTEN_OFF", "StockBatch",
                batchId.toString(), "{\"quantityOnHand\":" + before + "}",
                "{\"quantityOnHand\":" + batch.getQuantityOnHand() + ",\"quantity\":" + quantity
                        + ",\"reason\":\"" + reason.replace("\"", "'") + "\"}");
        stockMovementRepository.save(new StockMovement(batch.getFacilityId(), batch.getDrugName(), batchId,
                StockMovementType.WRITE_OFF, -quantity, before, batch.getQuantityOnHand(), batchId.toString(),
                userId, clock.instant()));
        return batch;
    }

    public StockOverview overview(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        List<StockBatch> batches = stockBatchRepository.findByFacilityId(facilityId);
        java.util.Map<String, Integer> totals = new java.util.TreeMap<>(String.CASE_INSENSITIVE_ORDER);
        for (StockBatch batch : batches) {
            totals.merge(batch.getDrugName(), batch.getQuantityOnHand(), Integer::sum);
        }
        java.util.Map<String, Integer> reorderLevels = new java.util.HashMap<>();
        for (StockReorderLevel level : stockReorderLevelRepository.findByFacilityId(facilityId)) {
            reorderLevels.put(level.getDrugName().toLowerCase(java.util.Locale.ROOT), level.getReorderLevel());
            totals.putIfAbsent(level.getDrugName(), 0);
        }
        List<StockItemView> items = totals.entrySet().stream()
                .map(entry -> {
                    int reorder = reorderLevels.getOrDefault(entry.getKey().toLowerCase(java.util.Locale.ROOT), 0);
                    return new StockItemView(entry.getKey(), entry.getValue(), reorder, entry.getValue() <= reorder);
                }).toList();
        return new StockOverview(facilityId, items, stockMovementRepository.findTop100ByFacilityIdOrderByCreatedAtDesc(facilityId));
    }

    @Transactional
    public StockReorderLevel setReorderLevel(UUID facilityId, String drugName, int reorderLevel, UUID userId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        String normalized = drugName.trim();
        StockReorderLevel level = stockReorderLevelRepository
                .findByFacilityIdAndDrugNameIgnoreCase(facilityId, normalized)
                .orElseGet(() -> new StockReorderLevel(facilityId, normalized, reorderLevel));
        level.setReorderLevel(reorderLevel);
        StockReorderLevel saved = stockReorderLevelRepository.save(level);
        auditLogService.append(userId, facilityId, "STOCK_REORDER_LEVEL_SET", "StockReorderLevel",
                saved.getId().toString(), null, "{\"reorderLevel\":" + reorderLevel + "}");
        return saved;
    }

    @Transactional
    public StockBatch count(UUID batchId, int countedQuantity, String reason, UUID userId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        StockBatch batch = stockBatchRepository.findByIdForUpdate(batchId)
                .orElseThrow(() -> new StockBatchNotFoundException(batchId.toString()));
        int before = batch.getQuantityOnHand();
        batch.adjustQuantity(countedQuantity);
        stockBatchRepository.save(batch);
        int delta = countedQuantity - before;
        stockMovementRepository.save(new StockMovement(batch.getFacilityId(), batch.getDrugName(), batchId,
                StockMovementType.ADJUSTMENT, delta, before, countedQuantity, batchId.toString(), userId, clock.instant()));
        auditLogService.append(userId, batch.getFacilityId(), "STOCK_COUNT_ADJUSTED", "StockBatch",
                batchId.toString(), "{\"quantityOnHand\":" + before + "}",
                "{\"quantityOnHand\":" + countedQuantity + ",\"variance\":" + delta
                        + ",\"reason\":\"" + reason.replace("\"", "'") + "\"}");
        return batch;
    }

    public record StockItemView(String drugName, int quantityOnHand, int reorderLevel, boolean reorderAlert) {}
    public record StockOverview(UUID facilityId, List<StockItemView> items, List<StockMovement> movements) {}

    public record ReceiveStockCommand(UUID facilityId, String drugName, String batchNumber, String barcode,
                                      LocalDate expiryDate, int quantity) {
    }
}
