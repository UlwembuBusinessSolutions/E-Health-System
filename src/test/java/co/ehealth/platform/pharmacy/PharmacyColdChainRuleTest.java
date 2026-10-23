package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.receiving.ColdChainRule;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PharmacyColdChainRuleTest {

    @ParameterizedTest
    @ValueSource(strings = {"2", "2.0", "4.5", "8", "8.0"})
    void temperaturesWithinTwoToEightAreCompliant(String celsius) {
        assertFalse(ColdChainRule.isBreached(new BigDecimal(celsius), true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.9", "0", "-5", "8.1", "12", "25"})
    void temperaturesOutsideTwoToEightAreBreached(String celsius) {
        assertTrue(ColdChainRule.isBreached(new BigDecimal(celsius), true));
    }

    @Test
    void anExplicitlyDamagedColdBoxIsBreachedEvenAtTheRightTemperature() {
        assertTrue(ColdChainRule.isBreached(new BigDecimal("5"), false));
    }

    @Test
    void anUnansweredColdBoxQuestionIsNotTreatedAsDamage() {
        assertFalse(ColdChainRule.isBreached(new BigDecimal("5"), null));
    }

    @Test
    void breachWithoutAFlagIsRejectedWithAnActionableMessage() {
        var ex = assertThrows(PharmacyValidationException.class, () -> ColdChainRule.requireCompliantOrFlagged(
                "Insulin 100 IU/ml", new BigDecimal("11.5"), true, false));

        assertTrue(ex.getMessage().contains("Insulin 100 IU/ml"));
        assertTrue(ex.getMessage().contains("Flag this line"));
    }

    @Test
    void damagedBoxWithoutAFlagIsRejected() {
        assertThrows(PharmacyValidationException.class, () -> ColdChainRule.requireCompliantOrFlagged(
                "Insulin", new BigDecimal("5"), false, false));
    }

    @Test
    void breachWithAFlagIsAccepted() {
        assertDoesNotThrow(() -> ColdChainRule.requireCompliantOrFlagged(
                "Insulin", new BigDecimal("11.5"), false, true));
    }

    @Test
    void compliantDeliveryNeedsNoFlag() {
        assertDoesNotThrow(() -> ColdChainRule.requireCompliantOrFlagged(
                "Insulin", new BigDecimal("4"), true, false));
    }

    @Test
    void missingTemperatureIsRejectedEvenWhenFlagged() {
        assertThrows(PharmacyValidationException.class,
                () -> ColdChainRule.requireCompliantOrFlagged("Insulin", null, true, true));
    }
}
