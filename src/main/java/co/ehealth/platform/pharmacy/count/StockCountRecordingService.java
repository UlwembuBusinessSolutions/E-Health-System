package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductNotFoundException;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;

// Everything a counter does while a draft is open: enter quantities, add
// lots found on the shelf, and explain differences.
@Service
public class StockCountRecordingService {

    static final int MAX_REASON_LENGTH = 200;

    public record FoundLotCommand(UUID productId, String lotNumber, LocalDate expiryDate, long quantity) {
    }

    private final StockCountLookup lookup;
    private final CountLotBalances lotBalances;
    private final FoundLotBatches foundLotBatches;
    private final PharmacyProductRepository productRepository;
    private final PharmacyStockCountLineRepository lineRepository;
    private final Clock clock;

    public StockCountRecordingService(StockCountLookup lookup, CountLotBalances lotBalances,
                                      FoundLotBatches foundLotBatches, PharmacyProductRepository productRepository,
                                      PharmacyStockCountLineRepository lineRepository, Clock clock) {
        this.lookup = lookup;
        this.lotBalances = lotBalances;
        this.foundLotBatches = foundLotBatches;
        this.productRepository = productRepository;
        this.lineRepository = lineRepository;
        this.clock = clock;
    }

    // The baseline is read here, at the moment of counting. If the lot is
    // dispensed or received afterwards, that movement is not part of this
    // line's variance, and posting adjusts the live balance by the
    // difference only.
    @Transactional
    public PharmacyStockCountLine recordCount(UUID countId, UUID lineId, long countedQuantity) {
        if (countedQuantity < 0) {
            throw new InvalidStockCountException("A counted quantity cannot be negative.");
        }
        PharmacyStockCount count = lookup.requireDraft(countId);
        PharmacyStockCountLine line = lookup.requireLine(countId, lineId);

        line.recordCount(countedQuantity, systemQuantityNow(count, line), clock.instant());
        return line;
    }

    @Transactional
    public PharmacyStockCountLine addFoundLot(UUID countId, FoundLotCommand command) {
        lookup.requireDraft(countId);
        String lotNumber = requireLotNumber(command.lotNumber());
        requireExpiryAndQuantity(command);
        requireBatchTrackedProduct(command.productId());
        requireLotNotAlreadyListed(countId, command.productId(), lotNumber);
        foundLotBatches.assertNoExpiryConflict(command.productId(), lotNumber, command.expiryDate());

        return lineRepository.save(PharmacyStockCountLine.forFoundLot(countId, command.productId(), lotNumber,
                command.expiryDate(), command.quantity(), clock.instant()));
    }

    @Transactional
    public PharmacyStockCountLine recordReason(UUID countId, UUID lineId, String reason) {
        lookup.requireDraft(countId);
        PharmacyStockCountLine line = lookup.requireLine(countId, lineId);
        if (!line.isCounted()) {
            throw new InvalidStockCountException("Count this lot before giving a reason for its difference.");
        }
        line.recordReason(requireReason(reason));
        return line;
    }

    private long systemQuantityNow(PharmacyStockCount count, PharmacyStockCountLine line) {
        if (line.getBatchId() == null) {
            return 0;
        }
        return lotBalances.balanceOf(count.getLocationId(), line.getProductId(), line.getBatchId());
    }

    private String requireLotNumber(String lotNumber) {
        if (lotNumber == null || lotNumber.isBlank()) {
            throw new InvalidStockCountException("Enter the lot number printed on the pack.");
        }
        return lotNumber.trim();
    }

    private void requireExpiryAndQuantity(FoundLotCommand command) {
        if (command.expiryDate() == null) {
            throw new InvalidStockCountException("Enter the full expiry date (day, month and year) of the lot.");
        }
        if (command.quantity() <= 0) {
            throw new InvalidStockCountException("Enter how many units were found.");
        }
    }

    private void requireBatchTrackedProduct(UUID productId) {
        PharmacyProduct product = productRepository.findById(productId)
                .orElseThrow(PharmacyProductNotFoundException::new);
        if (!product.isActive() || !product.isBatchTracked()) {
            throw new InvalidStockCountException(
                    product.getDisplayName() + " is not tracked by lot, so a found lot cannot be added for it.");
        }
    }

    private void requireLotNotAlreadyListed(UUID countId, UUID productId, String lotNumber) {
        if (lineRepository.existsByCountIdAndProductIdAndLotNumberIgnoreCase(countId, productId, lotNumber)) {
            throw new InvalidStockCountException(
                    "Lot " + lotNumber + " is already in this count. Enter its quantity on its own line.");
        }
    }

    private String requireReason(String reason) {
        if (reason == null || reason.isBlank()) {
            throw new InvalidStockCountException("Enter a reason for the difference.");
        }
        String trimmed = reason.trim();
        if (trimmed.length() > MAX_REASON_LENGTH) {
            throw new InvalidStockCountException(
                    "Keep the reason under " + MAX_REASON_LENGTH + " characters.");
        }
        return trimmed;
    }
}
