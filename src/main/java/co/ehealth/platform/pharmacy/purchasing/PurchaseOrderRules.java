package co.ehealth.platform.pharmacy.purchasing;

import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

// What makes a purchase order's lines acceptable. Pure rules with no
// repositories, so they can be read and tested on their own.
final class PurchaseOrderRules {

    record LineDraft(UUID productId, int packs, int packSize, int quantity) {
    }

    private PurchaseOrderRules() {
    }

    static void requireValidLines(List<LineDraft> lines) {
        if (lines.isEmpty()) {
            throw new PharmacyValidationException("Add at least one product to the order.");
        }
        Set<UUID> seenProducts = new HashSet<>();
        for (LineDraft line : lines) {
            requireQuantityMatchesPacks(line);
            if (!seenProducts.add(line.productId())) {
                throw new PharmacyValidationException(
                        "A product can only appear once on an order. Combine the lines into one.");
            }
        }
    }

    // Suppliers sell whole packs, so the units ordered are always packs times
    // pack size. Multiplied as long so a huge pair can't wrap around to a
    // quantity that happens to match.
    private static void requireQuantityMatchesPacks(LineDraft line) {
        if (line.packs() < 1 || line.packSize() < 1) {
            throw new PharmacyValidationException("Packs and pack size must each be at least 1.");
        }
        long expectedQuantity = (long) line.packs() * line.packSize();
        if (line.quantity() != expectedQuantity) {
            throw new PharmacyValidationException("The quantity on each line must equal packs x pack size ("
                    + line.packs() + " x " + line.packSize() + " = " + expectedQuantity + ").");
        }
    }
}
