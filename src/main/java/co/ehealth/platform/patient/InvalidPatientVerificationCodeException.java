package co.ehealth.platform.patient;

public class InvalidPatientVerificationCodeException extends RuntimeException {
    public InvalidPatientVerificationCodeException() {
        super("Incorrect or expired verification code.");
    }
}
