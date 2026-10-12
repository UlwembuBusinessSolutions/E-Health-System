package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.PurchaseReason;

import java.util.UUID;

// A line the patient is to buy rather than receive from the pharmacy. The
// pharmacy screens show it so the pharmacist knows the whole prescription, and
// the printed prescription lists it under "to buy", but it is never dispensed.
public record PrescriptionPurchaseItemResponse(UUID id, String drugName, String dosage, int quantity,
                                               UUID productId, String productName, PurchaseReason reason,
                                               String note) {
}
