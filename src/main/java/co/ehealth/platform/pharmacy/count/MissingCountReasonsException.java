package co.ehealth.platform.pharmacy.count;

import java.util.Map;

// Thrown by posting when variance lines have no reason; linesWithoutReason
// maps each offending line id to a plain-language description so the UI can
// point at the exact rows.
public class MissingCountReasonsException extends RuntimeException {

    private final Map<String, String> linesWithoutReason;

    public MissingCountReasonsException(Map<String, String> linesWithoutReason) {
        super("Add a reason to every line with a difference before posting this count.");
        this.linesWithoutReason = linesWithoutReason;
    }

    public Map<String, String> getLinesWithoutReason() {
        return linesWithoutReason;
    }
}
