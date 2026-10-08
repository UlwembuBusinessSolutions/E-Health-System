package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.ExpiryPrecision;
import co.ehealth.platform.pharmacy.stock.MissingExpiryException;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptService.LineFlag;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptService.ReceiveLineCommand;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

// Every business rule one receipt line must satisfy before any stock moves.
// Kept apart from PharmacyReceiptService so the rules can be read (and unit
// tested) without the posting machinery around them.
@Component
public class ReceiptLineValidator {

    private static final DateTimeFormatter DISPLAY_DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final Clock clock;

    public ReceiptLineValidator(Clock clock) {
        this.clock = clock;
    }

    public void validate(PharmacyProduct product, ReceiveLineCommand line) {
        requirePositiveQuantity(product, line);
        requireUsableExpiry(product, line);
        requireConsistentFlag(product, line);
        requireColdChainCompliance(product, line);
        requireMatchingSerials(product, line);
    }

    private void requirePositiveQuantity(PharmacyProduct product, ReceiveLineCommand line) {
        if (line.baseQuantity() == null || line.baseQuantity() <= 0) {
            throw new PharmacyValidationException(
                    "Enter a quantity of at least 1 for \"" + product.getDisplayName() + "\".");
        }
    }

    // Expiry is always a full calendar day: a month-only date cannot tell the
    // dispenser which day the stock stops being usable. A date that has
    // already passed means the supplier delivered expired stock, which must
    // be refused rather than put on the shelf. The expiry day itself is
    // still usable (PharmacyBatch.isExpiredAsOf: "usable through the recorded date").
    private void requireUsableExpiry(PharmacyProduct product, ReceiveLineCommand line) {
        if (!product.isExpiryTracked()) {
            return;
        }
        if (line.expiryDate() == null) {
            throw new MissingExpiryException(product.getDisplayName());
        }
        if (line.expiryPrecision() != ExpiryPrecision.DAY) {
            throw new PharmacyValidationException("Enter the full expiry date (day, month and year) for \""
                    + product.getDisplayName() + "\".");
        }
        LocalDate today = LocalDate.now(clock);
        if (line.expiryDate().isBefore(today)) {
            throw new PharmacyValidationException("\"" + product.getDisplayName() + "\" expired on "
                    + DISPLAY_DATE.format(line.expiryDate()) + ". Expired stock can't be received - "
                    + "refuse it and tell the supplier.");
        }
    }

    private void requireConsistentFlag(PharmacyProduct product, ReceiveLineCommand line) {
        LineFlag flag = line.flag();
        if (flag == null) {
            return;
        }
        if (flag.reason() == null) {
            throw new PharmacyValidationException(
                    "Choose why \"" + product.getDisplayName() + "\" is flagged (damaged, short, wrong item or near expiry).");
        }
        Integer accepted = flag.acceptedQuantity();
        if (accepted == null || accepted < 0 || accepted > line.baseQuantity()) {
            throw new PharmacyValidationException("For \"" + product.getDisplayName()
                    + "\", the accepted quantity must be between 0 and the " + line.baseQuantity() + " delivered.");
        }
    }

    private void requireColdChainCompliance(PharmacyProduct product, ReceiveLineCommand line) {
        if (product.isColdChain()) {
            ColdChainRule.requireCompliantOrFlagged(product.getDisplayName(), line.temperatureC(),
                    line.coldBoxIntact(), line.flag() != null);
        }
    }

    // A serial-tracked unit is its own identity, so the serial list IS the
    // quantity: one serial per accepted unit, no more, no fewer.
    private void requireMatchingSerials(PharmacyProduct product, ReceiveLineCommand line) {
        int serialCount = line.serialNumbers().size();
        if (product.isSerialTracked() && serialCount != line.stockedQuantity()) {
            throw new PharmacyValidationException("\"" + product.getDisplayName() + "\" is tracked by serial number: "
                    + "enter exactly one serial number for each of the " + line.stockedQuantity()
                    + " accepted units (you entered " + serialCount + ").");
        }
        if (!product.isSerialTracked() && serialCount > 0) {
            throw new PharmacyValidationException("\"" + product.getDisplayName()
                    + "\" is not tracked by serial number. Remove the serial numbers from this line.");
        }
    }
}
