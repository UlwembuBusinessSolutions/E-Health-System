package co.ehealth.platform.visit;

import java.math.BigDecimal;

public record TriageVitals(int respiratoryRate, int pulseRate, int systolicBp, BigDecimal temperature,
                           Avpu avpu, Mobility mobility, boolean trauma, boolean deceased) {
}
