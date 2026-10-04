package co.ehealth.platform.pharmacy.count;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// A count with its result summary. `lines` is only present on the detail
// endpoint. matches/differences are null for a blind draft, since even the
// number of differences would hint at the system quantities.
public record StockCountResponse(UUID id, UUID facilityId, CountScope scope, String scopeLabel, boolean blind,
                                 CountStatus status, String reference, String startedByName, Instant startedAt,
                                 String postedByName, Instant postedAt, int totalLots, int lotsCounted,
                                 Integer matches, Integer differences,
                                 @JsonInclude(JsonInclude.Include.NON_NULL) List<StockCountLineResponse> lines) {

    static StockCountResponse summaryOf(PharmacyStockCount count, List<PharmacyStockCountLine> lines) {
        return build(count, lines, null);
    }

    static StockCountResponse detailOf(PharmacyStockCount count, List<PharmacyStockCountLine> lines,
                                       List<StockCountLineResponse> lineResponses) {
        return build(count, lines, lineResponses);
    }

    private static StockCountResponse build(PharmacyStockCount count, List<PharmacyStockCountLine> lines,
                                            List<StockCountLineResponse> lineResponses) {
        int counted = (int) lines.stream().filter(PharmacyStockCountLine::isCounted).count();
        int differences = (int) lines.stream().filter(PharmacyStockCountLine::hasVariance).count();
        boolean hideResult = count.hidesBaselines();
        return new StockCountResponse(count.getId(), count.getFacilityId(), count.getScope(), count.getScopeLabel(),
                count.isBlind(), count.getStatus(), count.getReference(), count.getStartedByName(),
                count.getStartedAt(), count.getPostedByName(), count.getPostedAt(), lines.size(), counted,
                hideResult ? null : counted - differences, hideResult ? null : differences, lineResponses);
    }
}
