package co.ehealth.platform.visit;

import java.time.Instant;
import java.util.UUID;

// Shared between VisitController (the token a new visit was just issued)
// and QueueController (the active queue list, and whichever token
// callNext() just called) — same shape either way.
public record QueueTokenResponse(UUID id, UUID visitId, UUID facilityId, int tokenNumber, TokenPriority priority,
                                  TokenStatus status, boolean manual, Instant issuedAt, Instant calledAt) {
    static QueueTokenResponse from(QueueToken t) {
        return new QueueTokenResponse(t.getId(), t.getVisitId(), t.getFacilityId(), t.getTokenNumber(),
                t.getPriority(), t.getStatus(), t.isManual(), t.getIssuedAt(), t.getCalledAt());
    }
}
