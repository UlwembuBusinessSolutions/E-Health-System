package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.PrescriptionStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Enriched with the patient's name/MPI, the prescriber's name/registration
// number/phone/email (the queue's own Call/Message affordances), and each
// item's dispensing and stock detail — a staff-facing (and, via the print
// page, patient-facing) view where knowing WHO did what at a glance matters.
public record PrescriptionResponse(UUID id, String serialNumber, UUID visitId, UUID patientId, String patientName,
                                   String patientMpi, UUID facilityId, UUID prescriberId, String prescriberName,
                                   String prescriberRegistrationNumber, String prescriberPhone,
                                   String prescriberEmail, UUID consultationId, PrescriptionStatus status,
                                   List<PrescriptionItemResponse> items, Instant createdAt) {
}
