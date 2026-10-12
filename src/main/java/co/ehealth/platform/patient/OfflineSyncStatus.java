package co.ehealth.platform.patient;

// SYNCED   - registered on the server, an MPI now exists.
// CONFLICT - parked for a human (never silently overwritten).
// REJECTED - invalid payload; the device can correct and resend under the same clientRecordId.
// RESOLVED - a conflict a human has decided.
// RETRY_LATER is a response-only value and is never persisted: it tells the
// device "nothing was saved, keep it pending and try again".
public enum OfflineSyncStatus {
    SYNCED, CONFLICT, REJECTED, RESOLVED, RETRY_LATER
}