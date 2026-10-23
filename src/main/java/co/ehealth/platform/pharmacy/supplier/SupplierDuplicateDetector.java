package co.ehealth.platform.pharmacy.supplier;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Optional;

// Decides whether a new or renamed supplier collides with an existing one.
// An exact name_key match is always a duplicate; a name that merely contains
// (or is contained in) another supplier's key is only "similar" — and only
// once the shorter key is long enough to be meaningful, so "abc" does not
// flag every supplier whose name happens to include those letters.
@Component
public class SupplierDuplicateDetector {

    static final int MIN_SIMILAR_KEY_LENGTH = 5;

    public record Match(PharmacySupplier supplier, boolean similar) {
    }

    public Optional<Match> findMatch(String nameKey, Collection<PharmacySupplier> existingSuppliers) {
        Optional<PharmacySupplier> exact = existingSuppliers.stream()
                .filter(supplier -> supplier.getNameKey().equals(nameKey))
                .findFirst();
        if (exact.isPresent()) {
            return Optional.of(new Match(exact.get(), false));
        }
        return existingSuppliers.stream()
                .filter(supplier -> isSimilar(nameKey, supplier.getNameKey()))
                .findFirst()
                .map(supplier -> new Match(supplier, true));
    }

    private boolean isSimilar(String nameKey, String otherKey) {
        int shorterLength = Math.min(nameKey.length(), otherKey.length());
        if (shorterLength < MIN_SIMILAR_KEY_LENGTH) {
            return false;
        }
        return nameKey.contains(otherKey) || otherKey.contains(nameKey);
    }
}
