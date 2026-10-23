package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

// First-expiring-first-out lot choice for one dispense. Pure logic — it
// never reads or writes stock, it only decides which lots to draw from.
//
// An expired lot is never drawn from, whether FEFO would have reached it or
// the pharmacist picked it by hand: expiry changes dispensing eligibility,
// not the physical quantity (plan section 6).
@Component
public class FefoLotSelector {

    // preferredBatchId is the pharmacist's explicit choice; null means "pick
    // for me". An explicit lot is honoured exactly (one lot, or a clear
    // refusal) rather than topped up from other lots.
    public List<LotDraw> allocate(StockPicture stock, int quantity, UUID preferredBatchId) {
        if (preferredBatchId != null) {
            return List.of(drawFromChosenLot(stock, quantity, preferredBatchId));
        }
        return drawFirstExpiringFirst(stock, quantity);
    }

    private LotDraw drawFromChosenLot(StockPicture stock, int quantity, UUID batchId) {
        LotAvailability lot = stock.findLot(batchId).orElseThrow(() -> new DispensingConflictException(
                "That lot has no stock at this facility. Pick another lot."));
        if (stock.expiredLots().contains(lot)) {
            throw new ExpiredLotException(lot);
        }
        if (lot.available() < quantity) {
            throw new InsufficientUsableStockException(lot.available(), quantity, List.of());
        }
        return new LotDraw(lot, quantity);
    }

    // Always starts with the soonest-expiring lot and moves to the next only
    // when that one runs out. Taking a whole quantity from a later lot just
    // because it is big enough would leave short-dated units on the shelf to
    // expire, which is exactly what first-expiring-first exists to prevent.
    private List<LotDraw> drawFirstExpiringFirst(StockPicture stock, int quantity) {
        if (stock.usableTotal() < quantity) {
            throw new InsufficientUsableStockException(stock.usableTotal(), quantity, stock.expiredLots());
        }
        return spreadAcrossLots(stock.usableLots(), quantity);
    }

    private List<LotDraw> spreadAcrossLots(List<LotAvailability> usableLots, int quantity) {
        List<LotDraw> draws = new ArrayList<>();
        int stillNeeded = quantity;
        for (LotAvailability lot : usableLots) {
            if (stillNeeded == 0) {
                break;
            }
            int taken = (int) Math.min(lot.available(), stillNeeded);
            draws.add(new LotDraw(lot, taken));
            stillNeeded -= taken;
        }
        return draws;
    }
}
