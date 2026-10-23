package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.supplier.SupplierNameKey;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SupplierNameKeyTest {

    @ParameterizedTest(name = "\"{0}\" -> \"{1}\"")
    @CsvSource(delimiter = '|', value = {
            "Cipla Medpro (Pty) Ltd|ciplamedpro",
            "CIPLA MEDPRO|ciplamedpro",
            "Cipla-Medpro Limited|ciplamedpro",
            "The Medical Depot|medicaldepot",
            "Smith and Sons CC|smithsons",
            "Smith & Sons|smithsons",
            "Adcock Ingram Co.|adcockingram",
            "  Aspen   Pharmacare  |aspenpharmacare",
            "Sandoz|sandoz",
            "Andile's Pharma (Pty) Ltd|andilespharma",
            "MediCo|medico",
            "ABC 123 Supplies|abc123supplies"
    })
    void normalisesNames(String name, String expectedKey) {
        assertEquals(expectedKey, SupplierNameKey.of(name));
    }

    @Test
    void wholeWordsOnlyAreStripped() {
        // "and" sits inside Sandoz and "co" inside Cosmo; neither is a legal-form word there.
        assertEquals("sandoz", SupplierNameKey.of("Sandoz"));
        assertEquals("cosmopharm", SupplierNameKey.of("Cosmo Pharm"));
    }

    @Test
    void differentSpellingsOfTheSameCompanyShareAKey() {
        assertEquals(SupplierNameKey.of("Pharma Plus (Pty) Ltd"), SupplierNameKey.of("pharma-plus limited"));
    }

    @Test
    void nullOrOnlyNoiseGivesAnEmptyKey() {
        assertEquals("", SupplierNameKey.of(null));
        assertEquals("", SupplierNameKey.of("The Pty Ltd"));
        assertEquals("", SupplierNameKey.of("  --  "));
    }
}
