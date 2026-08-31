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
    private final PermissionService permissionService;
    private final AuditLogService auditLogService;
    private final Clock clock;
    private final int warningWindowDays;

    public StockService(StockBatchRepository stockBatchRepository, PermissionService permissionService,
                        AuditLogService auditLogService, Clock clock,
                        @Value("${app.pharmacy.expiry-warning-days:90}") int warningWindowDays) {
        this.stockBatchRepository = stockBatchRepository;
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
        return batch;
    }

    public record ReceiveStockCommand(UUID facilityId, String drugName, String batchNumber, String barcode,
                                      LocalDate expiryDate, int quantity) {
    }
}
