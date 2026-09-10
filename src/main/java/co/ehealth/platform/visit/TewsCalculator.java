package co.ehealth.platform.visit;

import java.math.BigDecimal;

public final class TewsCalculator {
    private TewsCalculator() {}

    public static int score(TriageVitals v) {
        if (v.deceased()) return 0;
        int score = 0;
        score += v.mobility() == Mobility.IMMOBILE ? 2 : v.mobility() == Mobility.WITH_HELP ? 1 : 0;
        score += band(v.respiratoryRate(), 8, 11, 12, 20, 30, 40);
        score += band(v.pulseRate(), 40, 50, 51, 100, 111, 130);
        score += v.systolicBp() <= 70 ? 3 : v.systolicBp() <= 80 || v.systolicBp() >= 200 ? 2
                : v.systolicBp() <= 100 ? 1 : 0;
        BigDecimal temperature = v.temperature();
        score += temperature.compareTo(BigDecimal.valueOf(35)) < 0 ? 2 : temperature.compareTo(BigDecimal.valueOf(38.4)) > 0 ? 1 : 0;
        score += switch (v.avpu()) {
            case ALERT -> 0;
            case VOICE -> 1;
            case PAIN -> 2;
            case UNRESPONSIVE -> 3;
        };
        return score + (v.trauma() ? 1 : 0);
    }

    private static int band(int value, int low3, int low2, int normalLow, int normalHigh,
                            int high2, int high3) {
        if (value <= low3 || value >= high3) return 3;
        if (value <= low2 || value >= high2) return 2;
        if (value < normalLow || value > normalHigh) return 1;
        return 0;
    }

    public static TriageColour colour(int score) {
        if (score >= 7) return TriageColour.RED;
        if (score >= 5) return TriageColour.ORANGE;
        if (score >= 3) return TriageColour.YELLOW;
        return TriageColour.GREEN;
    }

    public static TriageColour colour(TriageVitals v, int score) {
        return v.deceased() ? TriageColour.BLUE : colour(score);
    }
}
