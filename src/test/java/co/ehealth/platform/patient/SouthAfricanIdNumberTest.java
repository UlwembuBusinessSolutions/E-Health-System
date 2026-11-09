package co.ehealth.platform.patient;

import co.ehealth.platform.identity.Gender;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SouthAfricanIdNumberTest {

    @Test
    void parsesAValidIdAndDerivesIdentityAttributes() {
        SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse("8001015009087");

        assertEquals("1980-01-01", parsed.dateOfBirth().toString());
        assertEquals(Gender.MALE, parsed.gender());
        assertEquals(CitizenshipStatus.SA_CITIZEN, parsed.citizenshipStatus());
    }

    @Test
    void rejectsAnInvalidChecksum() {
        assertThrows(InvalidIdNumberException.class,
                () -> SouthAfricanIdNumber.parse("8001015009084"));
    }

    @Test
    void rejectsAnImpossibleBirthDateEvenWhenChecksumIsValid() {
        assertThrows(InvalidIdNumberException.class,
                () -> SouthAfricanIdNumber.parse("9913320000008"));
    }

    @Test
    void rejectsIdsWithTheWrongLengthOrNonDigits() {
        assertThrows(InvalidIdNumberException.class,
                () -> SouthAfricanIdNumber.parse("800101500908"));
        assertThrows(InvalidIdNumberException.class,
                () -> SouthAfricanIdNumber.parse("80010150090x4"));
    }
}
