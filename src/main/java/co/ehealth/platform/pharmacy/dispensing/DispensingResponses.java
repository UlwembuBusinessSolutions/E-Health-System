package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.PrescriptionStatus;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseOutcome;
import co.ehealth.platform.pharmacy.dispensing.DispenseReturnService.ReturnOutcome;
import co.ehealth.platform.pharmacy.dispensing.PrescriptionCollectionService.CollectOutcome;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

// The JSON bodies of the dispensing write endpoints, and the mapping from
// service outcomes to them.
public final class DispensingResponses {

    private DispensingResponses() {
    }

    public record LotQuantity(UUID batchId, String lot, LocalDate expiryDate, int quantity) {
        static LotQuantity of(LotDraw draw) {
            return new LotQuantity(draw.lot().batchId(), draw.lot().lotNumber(), draw.lot().expiryDate(),
                    draw.quantity());
        }
    }

    public record DispenseItemResponse(UUID itemId, PrescriptionStatus status, int dispensedNow,
                                       int dispensedQuantity, int remainingQuantity, List<LotQuantity> lots) {
        public static DispenseItemResponse of(DispenseOutcome outcome) {
            return new DispenseItemResponse(outcome.item().getId(), outcome.item().getStatus(),
                    outcome.dispensedNow(), outcome.item().getDispensedQuantity(),
                    outcome.item().getRemainingQuantity(), outcome.draws().stream().map(LotQuantity::of).toList());
        }
    }

    public record HandedOver(UUID itemId, String drugName, int quantity, List<LotQuantity> lots) {
    }

    public record Skipped(UUID itemId, String drugName, SkipReason reason, String message) {
    }

    // collectionId is null when nothing was in stock to hand over; skipped
    // lists every selected item that was left out and why.
    public record CollectResponse(UUID collectionId, List<HandedOver> handedOver, List<Skipped> skipped) {
        public static CollectResponse of(CollectOutcome outcome) {
            return new CollectResponse(outcome.collectionId(),
                    outcome.handedOver().stream().map(item -> new HandedOver(item.itemId(), item.drugName(),
                            item.quantity(), item.lots().stream().map(LotQuantity::of).toList())).toList(),
                    outcome.skipped().stream().map(item -> new Skipped(item.itemId(), item.drugName(),
                            item.reason(), item.reason().message())).toList());
        }
    }

    public record ReturnResponse(UUID itemId, int quantity, ReturnCondition condition, boolean restocked,
                                 int totalReturned, int stillReturnable) {
        public static ReturnResponse of(ReturnOutcome outcome) {
            return new ReturnResponse(outcome.itemId(), outcome.quantity(), outcome.condition(),
                    outcome.restocked(), outcome.totalReturned(), outcome.stillReturnable());
        }
    }
}
