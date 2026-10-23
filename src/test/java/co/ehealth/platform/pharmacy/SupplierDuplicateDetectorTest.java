package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.SupplierDuplicateDetector;
import co.ehealth.platform.pharmacy.supplier.SupplierDuplicateDetector.Match;
import co.ehealth.platform.pharmacy.supplier.SupplierNameKey;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupplierDuplicateDetectorTest {

    private final SupplierDuplicateDetector detector = new SupplierDuplicateDetector();

    private final PharmacySupplier cipla = PharmacyTestData.supplier("Cipla Medpro (Pty) Ltd");
    private final PharmacySupplier aspen = PharmacyTestData.supplier("Aspen Pharmacare");

    private Optional<Match> find(String newName) {
        return detector.findMatch(SupplierNameKey.of(newName), List.of(cipla, aspen));
    }

    @Test
    void sameNameWithDifferentPunctuationIsABlockingDuplicate() {
        Match match = find("CIPLA-MEDPRO limited").orElseThrow();

        assertEquals(cipla, match.supplier());
        assertFalse(match.similar());
    }

    @Test
    void nameContainingAnExistingSupplierIsOnlySimilar() {
        Match match = find("Cipla Medpro Gauteng").orElseThrow();

        assertEquals(cipla, match.supplier());
        assertTrue(match.similar());
    }

    @Test
    void nameContainedInAnExistingSupplierIsOnlySimilar() {
        Match match = find("Aspen Pharma").orElseThrow();

        assertEquals(aspen, match.supplier());
        assertTrue(match.similar());
    }

    @Test
    void exactMatchWinsOverASimilarOne() {
        PharmacySupplier longer = PharmacyTestData.supplier("Aspen Pharmacare Holdings");

        Match match = detector.findMatch(SupplierNameKey.of("Aspen Pharmacare"), List.of(longer, aspen)).orElseThrow();

        assertEquals(aspen, match.supplier());
        assertFalse(match.similar());
    }

    @Test
    void shortKeysAreNeverTreatedAsSimilar() {
        PharmacySupplier abc = PharmacyTestData.supplier("ABC");

        Optional<Match> match = detector.findMatch(SupplierNameKey.of("ABC Medical"), List.of(abc));

        assertTrue(match.isEmpty(), "a 3-letter key is too short to call a longer name similar");
    }

    @Test
    void fiveLetterKeyIsLongEnoughToBeSimilar() {
        PharmacySupplier medis = PharmacyTestData.supplier("Medis");

        Match match = detector.findMatch(SupplierNameKey.of("Medis Distributors"), List.of(medis)).orElseThrow();

        assertTrue(match.similar());
    }

    @Test
    void unrelatedNameHasNoMatch() {
        assertTrue(find("Dis-Chem Wholesale").isEmpty());
    }
}
