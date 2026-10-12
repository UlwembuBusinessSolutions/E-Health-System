package co.ehealth.platform.appointment;

public class AppointmentException extends RuntimeException {
    final int status;
    AppointmentException(int status, String message) { super(message); this.status = status; }
}
