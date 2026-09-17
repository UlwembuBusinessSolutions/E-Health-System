package co.ehealth.platform.facility;
public class StationInUseException extends RuntimeException {
    public StationInUseException() { super("Station cannot be removed while it has active tokens"); }
}
