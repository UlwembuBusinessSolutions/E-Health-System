package co.ehealth.platform.visit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class QueueTokenTest {

    private QueueToken newToken() {
        return new QueueToken(UUID.randomUUID(), UUID.randomUUID(), 1, TokenPriority.NORMAL, false,
                Instant.parse("2026-09-03T08:00:00Z"), UUID.randomUUID());
    }

    @Test
    void callRequiresAWaitingToken() {
        QueueToken token = newToken();
        token.call(Instant.parse("2026-09-03T08:10:00Z"));

        assertThrows(InvalidTokenTransitionException.class,
                () -> token.call(Instant.parse("2026-09-03T08:11:00Z")));
    }

    @Test
    void cancelledTokenCanBeReactivatedAndCancellationDetailsAreCleared() {
        QueueToken token = newToken();
        token.cancel(Instant.parse("2026-09-03T08:10:00Z"), "Patient requested", UUID.randomUUID());

        token.reactivate();

        assertEquals(TokenStatus.ISSUED, token.getStatus());
        assertNull(token.getCancelledAt());
        assertNull(token.getCancelReason());
        assertNull(token.getCancelledByUserId());
    }

    @Test
    void completedTokenCannotBeReactivated() {
        QueueToken token = newToken();
        token.call(Instant.parse("2026-09-03T08:10:00Z"));
        token.complete(Instant.parse("2026-09-03T08:30:00Z"));

        assertThrows(InvalidTokenTransitionException.class, token::reactivate);
    }
}
