package co.ehealth.platform.patient;

// USE_EXISTING  - keep the server record untouched; the offline capture is discarded.
// APPLY_OFFLINE - update the existing patient with the offline values (only
//                 non-blank ones), via PatientService.update() so field
//                 history and audit are written.
public enum SyncResolution {
    USE_EXISTING, APPLY_OFFLINE
}