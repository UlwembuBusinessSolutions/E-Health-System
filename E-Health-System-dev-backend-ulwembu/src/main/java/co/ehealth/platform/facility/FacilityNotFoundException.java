package co.ehealth.platform.facility;

// visit.VisitService.createVisit() — the target facilityId doesn't exist.
// Same shape as every other purpose-built NotFoundException in this
// codebase.
public class FacilityNotFoundException extends RuntimeException {
    public FacilityNotFoundException() {
        super("Unknown facility");
    }
}
