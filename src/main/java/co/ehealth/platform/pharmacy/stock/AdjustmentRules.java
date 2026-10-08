package co.ehealth.platform.pharmacy.stock;

import java.util.HashSet;
import java.util.List;

// The business rules of a manual stock adjustment, kept free of any
// repository so each one is a single, directly testable check. Messages are
// written for the pharmacist at the counter, not for a log.
final class AdjustmentRules {

    static final int MIN_NOTE_LENGTH = 3;

    private AdjustmentRules() {
    }

    static void validate(AdjustmentMode mode, AdjustmentReason reason, String note, int quantity,
                         List<String> serialNumbers, boolean serialTracked) {
        requireReasonMatchesMode(mode, reason);
        requireNoteWhenOther(reason == AdjustmentReason.OTHER, note);
        requirePositiveQuantity(quantity);
        if (serialTracked) {
            requireSerialsMatchQuantity(serialNumbers, quantity);
        } else if (serialNumbers != null && !serialNumbers.isEmpty()) {
            throw new InvalidStockRequestException("This product is not tracked by serial number, so serial numbers "
                    + "can't be entered. Enter a quantity instead.");
        }
    }

    // REMOVE can never exceed what the lot holds. The ledger enforces the
    // same under a row lock; checking here first lets the message name the
    // numbers instead of a generic "would go below zero".
    static void requireWithinBalance(long quantity, long lotBalance, String lotLabel) {
        if (quantity > lotBalance) {
            throw new InvalidStockRequestException("Only " + lotBalance + " in " + lotLabel
                    + " — you can't remove " + quantity + ".");
        }
    }

    private static void requireReasonMatchesMode(AdjustmentMode mode, AdjustmentReason reason) {
        if (!reason.isAllowedFor(mode)) {
            String action = mode == AdjustmentMode.ADD ? "adding" : "removing";
            throw new InvalidStockRequestException("\"" + reason + "\" isn't a valid reason for " + action
                    + " stock. Choose one of the listed reasons.");
        }
    }

    // Shared with reversals, whose "Other" reason follows the same rule.
    static void requireNoteWhenOther(boolean reasonIsOther, String note) {
        if (reasonIsOther && (note == null || note.trim().length() < MIN_NOTE_LENGTH)) {
            throw new InvalidStockRequestException("Add a short note explaining the reason \"Other\" "
                    + "(at least " + MIN_NOTE_LENGTH + " characters).");
        }
    }

    private static void requirePositiveQuantity(int quantity) {
        if (quantity <= 0) {
            throw new InvalidStockRequestException("Quantity must be a positive whole number.");
        }
    }

    private static void requireSerialsMatchQuantity(List<String> serialNumbers, int quantity) {
        if (serialNumbers == null || serialNumbers.isEmpty()) {
            throw new InvalidStockRequestException("This product is tracked by serial number — "
                    + "enter the serial number of each unit.");
        }
        if (serialNumbers.stream().anyMatch(serial -> serial == null || serial.isBlank())) {
            throw new InvalidStockRequestException("Serial numbers can't be blank.");
        }
        if (new HashSet<>(serialNumbers).size() != serialNumbers.size()) {
            throw new InvalidStockRequestException("The same serial number is listed more than once.");
        }
        if (serialNumbers.size() != quantity) {
            throw new InvalidStockRequestException("The quantity (" + quantity + ") must match the number of "
                    + "serial numbers entered (" + serialNumbers.size() + ").");
        }
    }
}
