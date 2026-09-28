package co.ehealth.platform.patient;

import co.ehealth.platform.identity.Gender;
import org.springframework.stereotype.Service;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.Year;
import java.util.Locale;

/**
 * PREG identity-document capture:
 *
 * The scanner/device supplies either:
 *  - a South African ID number, or
 *  - the decoded two-line passport MRZ.
 *
 * This service NEVER creates or modifies a Patient.
 * It only parses and validates the scanned identity data so the
 * registration screen can present it for staff confirmation.
 */
@Service
public class PatientIdentityScanService {

    public IdentityScanResult parseSouthAfricanId(String idNumber) {
        SouthAfricanIdNumber parsed = SouthAfricanIdNumber.parse(idNumber);

        return new IdentityScanResult(
                "SA_ID",
                null,
                null,
                parsed.dateOfBirth(),
                parsed.gender(),
                parsed.citizenshipStatus(),
                null,
                null,
                null,
                idNumber);
    }

    public IdentityScanResult parsePassportMrz(String mrz) {
        if (mrz == null || mrz.isBlank()) {
            throw new InvalidIdentityScanException(
                    "Passport MRZ is required.");
        }

        String normalized = mrz
                .replace("\r", "\n")
                .trim();

        String[] lines = normalized.split("\n");

        if (lines.length == 2) {
            return parseTd3(lines[0].trim(), lines[1].trim());
        }

        // Some scanners return both MRZ lines concatenated.
        String compact = normalized.replaceAll("\\s+", "");

        if (compact.length() == 88) {
            return parseTd3(
                    compact.substring(0, 44),
                    compact.substring(44));
        }

        throw new InvalidIdentityScanException(
                "Passport MRZ must contain two 44-character lines.");
    }

    private IdentityScanResult parseTd3(String line1, String line2) {
        if (line1.length() != 44 || line2.length() != 44) {
            throw new InvalidIdentityScanException(
                    "Passport MRZ must contain two 44-character lines.");
        }

        if (line1.charAt(0) != 'P') {
            throw new InvalidIdentityScanException(
                    "The supplied MRZ is not a passport MRZ.");
        }

        String documentType = line1.substring(0, 2);
        String issuingCountry = cleanMrz(line1.substring(2, 5));

        String[] nameParts = line1.substring(5)
                .split("<<", 2);

        if (nameParts.length != 2) {
            throw new InvalidIdentityScanException(
                    "Passport MRZ name section is invalid.");
        }

        String lastName = cleanMrz(nameParts[0]);
        String firstName = cleanMrz(nameParts[1]);

        // TD3:
        //
        // 0-8   passport number
        // 9     passport-number check digit
        // 10-12 nationality
        // 13-18 DOB YYMMDD
        // 19 DOB check digit
        // 20 sex
        // 21-26 expiry YYMMDD
        // 27 expiry check digit
        // 28-42 optional/personal number
        // 43 composite check digit
        //
        // We validate the three important MRZ fields individually and
        // validate the composite check digit as well.
        String passportNumber = cleanMrz(line2.substring(0, 9));
        char passportNumberCheck = line2.charAt(9);

        String nationality = cleanMrz(line2.substring(10, 13));

        String dobRaw = line2.substring(13, 19);
        char dobCheck = line2.charAt(19);

        char sexCode = line2.charAt(20);

        String expiryRaw = line2.substring(21, 27);
        char expiryCheck = line2.charAt(27);

        if (!checkMrzField(passportNumber, passportNumberCheck)) {
            throw new InvalidIdentityScanException(
                    "Passport number MRZ check digit is invalid.");
        }

        if (!checkMrzField(dobRaw, dobCheck)) {
            throw new InvalidIdentityScanException(
                    "Passport date-of-birth MRZ check digit is invalid.");
        }

        if (!checkMrzField(expiryRaw, expiryCheck)) {
            throw new InvalidIdentityScanException(
                    "Passport expiry MRZ check digit is invalid.");
        }

        String compositeInput = line2.substring(0, 10)
                + line2.substring(13, 20)
                + line2.substring(21, 43);

        if (!checkMrzField(compositeInput, line2.charAt(43))) {
            throw new InvalidIdentityScanException(
                    "Passport MRZ composite check digit is invalid.");
        }

        LocalDate dateOfBirth = parseMrzDate(dobRaw, true);
        LocalDate passportExpiry = parseMrzDate(expiryRaw, false);

        Gender gender = switch (sexCode) {
            case 'M' -> Gender.MALE;
            case 'F' -> Gender.FEMALE;
            case '<' -> null;
            default -> throw new InvalidIdentityScanException(
                    "Passport MRZ contains an invalid sex value.");
        };

        return new IdentityScanResult(
                "PASSPORT",
                firstName,
                lastName,
                dateOfBirth,
                gender,
                null,
                passportNumber,
                passportExpiry,
                nationality,
                null);
    }

    private LocalDate parseMrzDate(String value, boolean birthDate) {
        try {
            int yy = Integer.parseInt(value.substring(0, 2));
            int month = Integer.parseInt(value.substring(2, 4));
            int day = Integer.parseInt(value.substring(4, 6));

            int currentYear = Year.now().getValue();

            /*
             * MRZ dates contain only YY.
             *
             * For DOB, a future date is interpreted as the previous
             * century. For passport expiry, the nearest sensible future
             * date is preferred.
             */
            int currentTwoDigitYear = currentYear % 100;

            int year;

            if (birthDate) {
                year = yy <= currentTwoDigitYear
                        ? 2000 + yy
                        : 1900 + yy;
            } else {
                year = yy >= currentTwoDigitYear
                        ? 2000 + yy
                        : 2100 + yy;
            }

            return LocalDate.of(year, month, day);

        } catch (DateTimeException | NumberFormatException e) {
            throw new InvalidIdentityScanException(
                    "Passport MRZ contains an invalid date.");
        }
    }

    private boolean checkMrzField(String value, char expectedCheckDigit) {
        if (expectedCheckDigit < '0' || expectedCheckDigit > '9') {
            return false;
        }

        int expected = expectedCheckDigit - '0';
        int sum = 0;

        for (int i = 0; i < value.length(); i++) {
            int valueNumber = mrzValue(value.charAt(i));
            int weight = switch (i % 3) {
                case 0 -> 7;
                case 1 -> 3;
                default -> 1;
            };

            sum += valueNumber * weight;
        }

        return sum % 10 == expected;
    }

    private int mrzValue(char c) {
        if (c >= '0' && c <= '9') {
            return c - '0';
        }

        if (c >= 'A' && c <= 'Z') {
            return c - 'A' + 10;
        }

        if (c == '<') {
            return 0;
        }

        throw new InvalidIdentityScanException(
                "Passport MRZ contains an invalid character.");
    }

    private String cleanMrz(String value) {
        return value
                .replace('<', ' ')
                .replaceAll("\\s+", " ")
                .trim();
    }

    public record IdentityScanResult(
            String documentType,
            String firstName,
            String lastName,
            LocalDate dateOfBirth,
            Gender gender,
            CitizenshipStatus citizenshipStatus,
            String passportNumber,
            LocalDate passportExpiry,
            String nationality,
            String idNumber) {
    }
}