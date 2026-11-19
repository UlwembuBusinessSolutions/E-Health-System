package co.ehealth.platform.pharmacy.dispensing;

import java.util.Locale;

// The key a prescribed drug name is remembered under. Lower-case, with
// punctuation turned into single spaces, so "Amoxicillin 500mg." and
// "amoxicillin  500mg" are the same name — but nothing looser than that:
// matching stays exact so a similar-looking name never maps by accident.
public final class DrugNames {

    private DrugNames() {
    }

    public static String normalise(String drugName) {
        return drugName.toLowerCase(Locale.ROOT)
                .replaceAll("[^\\p{L}\\p{N}]+", " ")
                .trim();
    }
}
