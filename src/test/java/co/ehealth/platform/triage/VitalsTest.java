package co.ehealth.platform.triage;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class VitalsTest {
    private final TewsCalculator calculator = new TewsCalculator();
    private TewsCalculator.Result score(int rr, int hr, int bp, double temp, Avpu avpu, Mobility mobility, boolean trauma) {
        var observations = new AdditionalObservations();
        observations.traumaPresent = trauma;
        return calculator.calculate(false, ScoringProfile.ADULT, rr, hr, bp, temp, avpu, mobility, Set.of(), observations);
    }

    // SATS manual adult chart, pp. 8/26. Exercise both ends of every band.
    @ParameterizedTest
    @CsvSource({"8,3", "9,1", "14,1", "15,0", "20,0", "21,2", "29,2", "30,3"})
    void adultRespiratoryBoundaries(int rr, int expected) {
        assertEquals(expected, score(rr, 80, 120, 37, Avpu.ALERT, Mobility.WALKING, false).tewsScore());
    }

    @ParameterizedTest
    @CsvSource({"40,3", "41,1", "50,1", "51,0", "100,0", "101,1", "110,1", "111,2", "129,2", "130,3"})
    void adultPulseBoundaries(int pulse, int expected) {
        assertEquals(expected, score(18, pulse, 120, 37, Avpu.ALERT, Mobility.WALKING, false).tewsScore());
    }

    @ParameterizedTest
    @CsvSource({"70,3", "71,2", "80,2", "81,1", "100,1", "101,0", "199,0", "200,2"})
    void adultPressureBoundaries(int bp, int expected) {
        assertEquals(expected, score(18, 80, bp, 37, Avpu.ALERT, Mobility.WALKING, false).tewsScore());
    }

    @ParameterizedTest
    @CsvSource({"34.9,2", "35,0", "38.4,0", "38.5,2"})
    void temperatureBoundaries(double temp, int expected) {
        assertEquals(expected, score(18, 80, 120, temp, Avpu.ALERT, Mobility.WALKING, false).tewsScore());
    }

    @Test void traumaChangesBothScoreAndPriorityAtBoundary() {
        var without = score(21, 80, 120, 37, Avpu.ALERT, Mobility.WALKING, false);
        var with = score(21, 80, 120, 37, Avpu.ALERT, Mobility.WALKING, true);
        assertEquals(2, without.tewsScore()); assertEquals(TriageColour.GREEN, without.calculatedColour());
        assertEquals(3, with.tewsScore()); assertEquals(TriageColour.YELLOW, with.calculatedColour());
        assertEquals(TriageColour.YELLOW, score(21, 80, 120, 38.5, Avpu.ALERT, Mobility.WALKING, false).calculatedColour());
        assertEquals(TriageColour.ORANGE, score(21, 80, 120, 38.5, Avpu.ALERT, Mobility.WALKING, true).calculatedColour());
        assertEquals(TriageColour.RED, score(30, 130, 120, 37, Avpu.ALERT, Mobility.WALKING, true).calculatedColour());
    }

    @Test void consciousnessPointsAndMinimumPriority() {
        assertEquals(1, score(18, 80, 120, 37, Avpu.VOICE, Mobility.WALKING, false).tewsScore());
        assertEquals(2, score(18, 80, 120, 37, Avpu.PAIN, Mobility.WALKING, false).tewsScore());
        assertEquals(2, score(18, 80, 120, 37, Avpu.CONFUSED, Mobility.WALKING, false).tewsScore());
        assertEquals(TriageColour.ORANGE, score(18, 80, 120, 37, Avpu.VOICE, Mobility.WALKING, false).calculatedColour());
    }

    @Test void glucoseBelowThreeRaisesRedEvenWithNormalVitals() {
        var observations = new AdditionalObservations(); observations.glucoseMmolL = 2.9;
        assertEquals(TriageColour.RED, calculator.calculate(false, ScoringProfile.ADULT, 18, 80, 120,
                37.0, Avpu.ALERT, Mobility.WALKING, Set.of(), observations).calculatedColour());
        observations.glucoseMmolL = 3.0;
        assertEquals(TriageColour.GREEN, calculator.calculate(false, ScoringProfile.ADULT, 18, 80, 120,
                37.0, Avpu.ALERT, Mobility.WALKING, Set.of(), observations).calculatedColour());
    }

    @Test void optionalValuesAndNegativeResultsRemainDistinct() throws Exception {
        var mapper = new ObjectMapper();
        var a = mapper.readValue("{\"weightKg\":72.5,\"heightCm\":170,\"urineKetones\":\"NEGATIVE\",\"pregnancyTest\":\"INDETERMINATE\"}", AdditionalObservations.class);
        a.validate();
        assertEquals(25.1, a.getBmi());
        assertNull(a.traumaPresent); assertNull(a.glucoseMmolL); assertNull(a.urineProtein);
        var json = mapper.readTree(mapper.writeValueAsString(a));
        assertEquals("NEGATIVE", json.get("urineKetones").asText());
        assertEquals("INDETERMINATE", json.get("pregnancyTest").asText());
        assertEquals(25.1, json.get("bmi").asDouble());
        a.heightCm = null; assertNull(a.getBmi());
    }

    @Test void rejectsInvalidNumbersAndUnsupportedResults() {
        for (double bad : new double[]{0, -1, Double.NaN, Double.POSITIVE_INFINITY}) {
            var a = new AdditionalObservations(); a.weightKg = bad;
            assertThrows(InvalidTriageCaptureException.class, a::validate);
        }
        var a = new AdditionalObservations(); a.pregnancyTest = "NORMAL";
        assertThrows(InvalidTriageCaptureException.class, a::validate);
        a.pregnancyTest = null; a.urineKetones = "unknown";
        assertThrows(InvalidTriageCaptureException.class, a::validate);
    }

    @Test void clientCannotOverrideCalculatedBmi() throws Exception {
        var a = new ObjectMapper().readValue("{\"weightKg\":72.5,\"heightCm\":170,\"bmi\":99}", AdditionalObservations.class);
        assertEquals(25.1, a.getBmi());
    }
}
