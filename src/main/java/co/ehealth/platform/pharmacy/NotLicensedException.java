package co.ehealth.platform.pharmacy;

// PHRM-US-009's guard — thrown instead of creating a Prescription or
// DispensingRecord when the acting user has no current, non-expired
// professional registration of the relevant kind (StaffService.LicenseStatus's
// own why-note on exactly what "licensed" means here).
public class NotLicensedException extends RuntimeException {
    public NotLicensedException(String message) {
        super(message);
    }
}
