package co.ehealth.platform.facility;

// ConsultationService's "Send to pharmacy" outcome — this organization has
// no active facility of type PHARMACY to transfer the visit's queue token
// to. The request is well-formed, it just can't complete until an org
// admin (or platform operator, via "Add clinic") provisions one — same
// "conflicts with current state" shape as OrganizationSuspendedException.
public class PharmacyFacilityNotConfiguredException extends RuntimeException {
    public PharmacyFacilityNotConfiguredException() {
        super("This organization has no pharmacy facility configured yet.");
    }
}
