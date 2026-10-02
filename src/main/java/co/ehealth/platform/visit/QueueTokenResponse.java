package co.ehealth.platform.visit;

import java.time.Instant;
import java.util.UUID;

// Shared between VisitController (the token a new visit was just issued)
// and QueueController (the active queue list, and whichever token
// callNext()/markMissed()/reactivate()/complete()/cancel() just acted on)
// — same shape either way.
public record QueueTokenResponse(UUID id, UUID visitId, UUID facilityId, int tokenNumber, TokenPriority priority,
                                  TokenStatus status, boolean manual, Instant issuedAt, Instant calledAt,
                                  Instant missedAt, Instant completedAt, Instant cancelledAt, String cancelReason) {
    static QueueTokenResponse from(QueueToken t) {
        return new QueueTokenResponse(t.getId(), t.getVisitId(), t.getFacilityId(), t.getTokenNumber(),
                t.getPriority(), t.getStatus(), t.isManual(), t.getIssuedAt(), t.getCalledAt(), t.getMissedAt(),
                t.getCompletedAt(), t.getCancelledAt(), t.getCancelReason());
    }
}
