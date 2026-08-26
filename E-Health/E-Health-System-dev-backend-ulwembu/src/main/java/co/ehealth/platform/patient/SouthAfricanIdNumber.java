package co.ehealth.platform.patient;

import co.ehealth.platform.identity.Gender;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.Year;

// PREG-US-003's "SA ID check-digit validation" + "DOB/gender auto-derived" —
// the registration form only ever collects the 13-digit number itself;
// everything here is what turns that single field into the three others
// PatientService.register() actually stores. Format: YYMMDD SSSS C A Z —
// birthdate, gender sequence, citizenship, (unused race digit, historical),
// Luhn check digit. A parse() call either returns all three derived values
// together or throws — there's no partially-valid ID number.
public record SouthAfricanIdNumber(LocalDate dateOfBirth, Gender gender, CitizenshipStatus citizenshipStatus) {

    public static SouthAfricanIdNumber parse(String idNumber) {
        if (idNumber == null || !idNumber.matches("\\d{13}")) {
            throw new InvalidIdNumberException();
        }
        int[] digits = idNumber.chars().map(c -> c - '0').toArray();
        if (!hasValidCheckDigit(digits)) {
            throw new InvalidIdNumberException();
        }

        LocalDate dateOfBirth = deriveDateOfBirth(idNumber);
        int genderSequence = Integer.parseInt(idNumber.substring(6, 10));
        Gender gender = genderSequence < 5000 ? Gender.FEMALE : Gender.MALE;
        CitizenshipStatus citizenship = digits[10] == 0 ? CitizenshipStatus.SA_CITIZEN : CitizenshipStatus.PERMANENT_RESIDENT;

        return new SouthAfricanIdNumber(dateOfBirth, gender, citizenship);
    }

    // The standard Home Affairs Luhn variant: sum the odd-position digits
    // (1st, 3rd, ... 11th) directly; take the even-position digits (2nd,
    // 4th, ... 12th) as a 6-digit number, double it, and sum ITS digits;
    // the 13th digit must make both sums' total a multiple of 10.
    private static boolean hasValidCheckDigit(int[] digits) {
        int oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8] + digits[10];

        long evenNumber = 0;
        for (int i = 1; i <= 11; i += 2) {
            evenNumber = evenNumber * 10 + digits[i];
        }
        long doubled = evenNumber * 2;
        int evenSum = 0;
        while (doubled > 0) {
            evenSum += (int) (doubled % 10);
            doubled /= 10;
        }

        int expectedCheckDigit = (10 - ((oddSum + evenSum) % 10)) % 10;
        return expectedCheckDigit == digits[12];
    }

    // YY alone is ambiguous between 1900s and 2000s — the standard
    // resolution is "whichever century doesn't put the birthdate in the
    // future." A YY equal to the current two-digit year is treated as this
    // century (a newborn), not next century minus 100 years.
    private static LocalDate deriveDateOfBirth(String idNumber) {
        int yy = Integer.parseInt(idNumber.substring(0, 2));
        int month = Integer.parseInt(idNumber.substring(2, 4));
        int day = Integer.parseInt(idNumber.substring(4, 6));
        int currentYearYY = Year.now().getValue() % 100;
        int century = yy <= currentYearYY ? 2000 : 1900;
        try {
            return LocalDate.of(century + yy, month, day);
        } catch (DateTimeException e) {
            throw new InvalidIdNumberException();
        }
    }
}
