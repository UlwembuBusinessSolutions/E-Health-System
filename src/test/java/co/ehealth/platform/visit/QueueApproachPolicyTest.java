package co.ehealth.platform.visit;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QueueApproachPolicyTest {

    @Test
    void notifiesAtTwoTokensAheadEvenWhenEstimateExceedsTenMinutes() {
        assertTrue(QueueApproachPolicy.shouldNotify(2, 8.0));
    }

    @Test
    void notifiesAtTenMinuteEstimateEvenWhenMoreThanTwoTokensAreAhead() {
        assertTrue(QueueApproachPolicy.shouldNotify(3, 3.0));
    }

    @Test
    void doesNotNotifyWhenBothThresholdsAreStillBeyondReach() {
        assertFalse(QueueApproachPolicy.shouldNotify(3, 4.0));
    }

    @Test
    void doesNotNotifyWhenPatientIsAlreadyNextAndNoOneIsAhead() {
        assertFalse(QueueApproachPolicy.shouldNotify(0, 5.0));
    }
}