package co.ehealth.platform.pharmacy.count;

import org.springframework.stereotype.Component;

import java.util.UUID;

// Loads a count (or one of its lines) and enforces "only a draft can be
// changed", so every editing service shares the same wording and status.
@Component
class StockCountLookup {

    private final PharmacyStockCountRepository countRepository;
    private final PharmacyStockCountLineRepository lineRepository;

    StockCountLookup(PharmacyStockCountRepository countRepository, PharmacyStockCountLineRepository lineRepository) {
        this.countRepository = countRepository;
        this.lineRepository = lineRepository;
    }

    PharmacyStockCount requireCount(UUID countId) {
        return countRepository.findById(countId).orElseThrow(StockCountNotFoundException::new);
    }

    PharmacyStockCount requireDraft(UUID countId) {
        PharmacyStockCount count = requireCount(countId);
        requireStillDraft(count);
        return count;
    }

    void requireStillDraft(PharmacyStockCount count) {
        if (!count.isDraft()) {
            throw new InvalidStockCountStateException(
                    "This count is " + count.getStatus().name().toLowerCase() + " and can no longer be changed.");
        }
    }

    PharmacyStockCountLine requireLine(UUID countId, UUID lineId) {
        return lineRepository.findByIdAndCountId(lineId, countId).orElseThrow(StockCountLineNotFoundException::new);
    }
}
