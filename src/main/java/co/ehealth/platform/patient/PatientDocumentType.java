package co.ehealth.platform.patient;

public enum PatientDocumentType {
    ID_COPY,
    MEDICAL_AID_CARD,
    // Not "just another document" conceptually — a headshot for visual
    // identification, same purpose StaffPhotoService serves for staff — but
    // stored through this same upload/list/download-url path deliberately:
    // PatientDocumentService's own why-note on why patient uploads never
    // get a permanent public-base-url link the way StaffPhotoService's do
    // applies just as much to a patient's photo as to their ID copy, so
    // this reuses that private, presigned-URL infrastructure rather than
    // adding a second, more permissive upload path just for this one type.
    PATIENT_PHOTO,
    // A minor typically has no ID book/card to stand in for ID_COPY — the
    // birth certificate (carrying the same Home Affairs-issued ID number)
    // is the equivalent identity document for a child patient. Same
    // upload/list/download-url path as every other type here; nothing
    // about it needs its own service or storage rule.
    BIRTH_CERTIFICATE
}
