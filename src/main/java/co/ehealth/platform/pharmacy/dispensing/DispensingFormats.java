package co.ehealth.platform.pharmacy.dispensing;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// Messages show dates the way the pharmacy UI does: "3 Mar 2026".
final class DispensingFormats {

    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private DispensingFormats() {
    }

    static String date(LocalDate date) {
        return DISPLAY_DATE.format(date);
    }
}
