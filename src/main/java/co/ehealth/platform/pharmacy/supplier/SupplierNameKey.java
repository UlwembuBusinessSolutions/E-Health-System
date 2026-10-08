package co.ehealth.platform.pharmacy.supplier;

import java.util.Locale;
import java.util.regex.Pattern;

// The comparison form of a supplier name, stored as pharmacy_suppliers.name_key.
// "Cipla Medpro (Pty) Ltd", "CIPLA MEDPRO" and "Cipla-Medpro Limited" must all
// be recognised as the same supplier, so legal-form noise words and every
// non-alphanumeric character are dropped before comparing.
public final class SupplierNameKey {

    // Whole words only: "and" inside "Sandoz" must survive.
    private static final Pattern NOISE_WORDS = Pattern.compile("\\b(pty|ltd|limited|the|and|co|cc)\\b");
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9]");

    private SupplierNameKey() {
    }

    public static String of(String name) {
        if (name == null) {
            return "";
        }
        String lowerCased = name.toLowerCase(Locale.ROOT);
        String withoutNoiseWords = NOISE_WORDS.matcher(lowerCased).replaceAll(" ");
        return NON_ALPHANUMERIC.matcher(withoutNoiseWords).replaceAll("");
    }
}
