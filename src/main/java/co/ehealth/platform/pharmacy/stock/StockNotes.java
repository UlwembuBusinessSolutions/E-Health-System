package co.ehealth.platform.pharmacy.stock;

import org.springframework.util.StringUtils;

final class StockNotes {

    private StockNotes() {
    }

    // The free-text note as stored on a ledger transaction: trimmed, and null
    // rather than an empty string when the pharmacist left it blank.
    static String normalized(String note) {
        return StringUtils.hasText(note) ? note.trim() : null;
    }
}
