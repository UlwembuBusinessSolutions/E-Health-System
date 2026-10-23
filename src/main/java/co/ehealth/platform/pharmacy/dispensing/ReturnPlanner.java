package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// Decides which lots a return goes back against. A return can never exceed
// what was dispensed minus what was already returned, checked lot by lot so
// stock never lands in a lot the patient did not receive from. Pure logic.
@Component
public class ReturnPlanner {

    public record LotReturn(UUID batchId, int quantity) {
    }

    // allocations are in dispensing order. The most recently dispensed lot is
    // returned against first: it is the likeliest to still be the unit in the
    // patient's hand.
    public List<LotReturn> plan(List<DispenseAllocation> allocations, List<PrescriptionReturn> earlierReturns,
                                 int quantity) {
        Map<UUID, Integer> returnableByLot = returnableByLotNewestFirst(allocations, earlierReturns);
        int totalReturnable = returnableByLot.values().stream().mapToInt(Integer::intValue).sum();
        if (quantity > totalReturnable) {
            throw new DispensingValidationException(totalReturnable == 0
                    ? "Everything dispensed for this item has already been returned."
                    : "Only " + totalReturnable + " units of this item can still be returned.");
        }
        return takeFromLots(returnableByLot, quantity);
    }

    public int totalReturnable(List<DispenseAllocation> allocations, List<PrescriptionReturn> earlierReturns) {
        return returnableByLotNewestFirst(allocations, earlierReturns).values().stream()
                .mapToInt(Integer::intValue).sum();
    }

    private Map<UUID, Integer> returnableByLotNewestFirst(List<DispenseAllocation> allocations,
                                                          List<PrescriptionReturn> earlierReturns) {
        Map<UUID, Integer> returnable = new LinkedHashMap<>();
        for (int i = allocations.size() - 1; i >= 0; i--) {
            DispenseAllocation allocation = allocations.get(i);
            returnable.merge(allocation.getBatchId(), allocation.getQuantity(), Integer::sum);
        }
        earlierReturns.forEach(earlier -> returnable.computeIfPresent(earlier.getBatchId(),
                (batchId, left) -> left - earlier.getQuantity()));
        returnable.values().removeIf(left -> left <= 0);
        return returnable;
    }

    private List<LotReturn> takeFromLots(Map<UUID, Integer> returnableByLot, int quantity) {
        List<LotReturn> returns = new ArrayList<>();
        int stillToReturn = quantity;
        for (Map.Entry<UUID, Integer> lot : returnableByLot.entrySet()) {
            if (stillToReturn == 0) {
                break;
            }
            int taken = Math.min(lot.getValue(), stillToReturn);
            returns.add(new LotReturn(lot.getKey(), taken));
            stillToReturn -= taken;
        }
        return returns;
    }
}
