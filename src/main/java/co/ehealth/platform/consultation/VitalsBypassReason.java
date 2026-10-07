package co.ehealth.platform.consultation;

// Why a consultation was started for a visit that has no vitals on record. A visit
// normally goes through vitals first; skipping that is allowed only with a reason that
// stays on the record, so a missing reading is never mistaken for a normal one.
public enum VitalsBypassReason {
    // The patient needs the doctor now; vitals follow or are not possible yet.
    EMERGENCY,
    // A repeat or follow-up visit where nothing has changed since the last readings.
    FOLLOW_UP_NO_CHANGE,
    // Anything else; a note explaining it is required.
    OTHER
}
