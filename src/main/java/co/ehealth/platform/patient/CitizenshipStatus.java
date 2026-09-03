package co.ehealth.platform.patient;

// Derived from a South African ID number's own 11th digit (0 = citizen,
// anything else = permanent resident) — PREG-US-003's "citizenship" core
// field. Foreign nationals with no SA ID/passport at all are PREG-US-004,
// explicitly Blocked/Not Ready in the backlog (BRD Open Item OI-009) — out
// of scope here, which is also why SouthAfricanIdNumber.parse() has no
// third case to produce.
public enum CitizenshipStatus {
    SA_CITIZEN,
    PERMANENT_RESIDENT
}
