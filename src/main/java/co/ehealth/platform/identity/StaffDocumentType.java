package co.ehealth.platform.identity;

// PatientDocumentType's own staff-side counterpart. Mirrors the plain
// "what kind of paperwork is this" split real HR files actually use —
// nothing here drives eligibility logic the way sancNumber/hpcsaNumber/
// sapcNumber on User already do (those remain the source of truth for
// "can this person dispense/prescribe"); a scanned certificate is
// supporting evidence, not itself checked anywhere.
public enum StaffDocumentType {
    QUALIFICATION_CERTIFICATE,
    PROFESSIONAL_REGISTRATION_CERTIFICATE,
    ID_COPY,
    CONTRACT,
    OTHER
}
