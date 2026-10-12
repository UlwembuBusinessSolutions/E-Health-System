package co.ehealth.platform.patient;

public class OfflineSyncRecordNotFoundException extends RuntimeException {
    public OfflineSyncRecordNotFoundException() {
        super("Unknown sync record");
    }
}