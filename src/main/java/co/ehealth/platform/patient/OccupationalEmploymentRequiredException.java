package co.ehealth.platform.patient;

public class OccupationalEmploymentRequiredException extends RuntimeException {

    public OccupationalEmploymentRequiredException() {
        super("Employer and employee number are required for occupational health patients.");
    }
}
