package co.ehealth.platform.pharmacy.register;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

// The reconciliation card. Before sign-off, closed is false and the
// counted/variance/sign-off fields are null; after it, the card shows what
// was signed and by whom.
public record DayCloseResponse(UUID facilityId, UUID productId, LocalDate date, long opening, long received,
                               long dispensed, long destroyed, long lost, long returned, long expected,
                               boolean closed, Long counted, Long variance, String varianceReason,
                               String closedByName, Instant closedAt) {

    static DayCloseResponse from(ScheduleDayCloseService.Reconciliation reconciliation) {
        DayFigures figures = reconciliation.figures();
        ScheduleDayClose close = reconciliation.close();
        boolean closed = close != null;
        return new DayCloseResponse(reconciliation.facilityId(), reconciliation.productId(), reconciliation.date(),
                figures.opening(), figures.received(), figures.dispensed(), figures.destroyed(), figures.lost(),
                figures.returned(), figures.expected(), closed, closed ? close.getCounted() : null,
                closed ? close.getVariance() : null, closed ? close.getVarianceReason() : null,
                closed ? close.getClosedByName() : null, closed ? close.getClosedAt() : null);
    }
}
