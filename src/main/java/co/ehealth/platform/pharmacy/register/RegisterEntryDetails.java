package co.ehealth.platform.pharmacy.register;

import java.util.UUID;

// Everything needed to append one register entry, before the balance is
// known. `actor` is whoever physically handled the medicine; `witness` is
// null unless a second person confirmed it. `reason` is why stock was destroyed
// or lost (null for other kinds).
public record RegisterEntryDetails(UUID facilityId, UUID productId, RegisterEntryKind kind, long quantity,
                                   String rxSerial, String patientName, String patientIdRef,
                                   String prescriberName, String prescriberRegNo, String lotNumber,
                                   RegisterStaff actor, RegisterStaff witness, UUID ledgerTransactionId,
                                   String reason) {
}
