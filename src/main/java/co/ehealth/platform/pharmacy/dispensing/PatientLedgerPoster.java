package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.stock.LedgerContext;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService.EntryRequest;
import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.stream.Collectors;

// Posts a ledger movement that belongs to a patient's prescription: the
// prescription serial is the transaction's source reference and, together
// with the patient, travels in the posting's LedgerContext so the
// patient-linked ledger history can read them straight off the row. Runs inside the caller's transaction, so the stock movement and the
// dispensing record commit or roll back together (STK-11).
@Component
public class PatientLedgerPoster {

    private final PharmacyStockLedgerService ledgerService;

    public PatientLedgerPoster(PharmacyStockLedgerService ledgerService) {
        this.ledgerService = ledgerService;
    }

    // idempotencyKey is derived from the prescription item and the attempt
    // (callers pass the quantity already dispensed/returned), so a replayed
    // request returns the original transaction instead of moving stock twice.
    public PharmacyStockTransaction post(StockTransactionType type, Prescription prescription,
                                          DispensingActor actor, String reason, String idempotencyKey,
                                          List<EntryRequest> entries) {
        LedgerContext patientContext = new LedgerContext(null, null, prescription.getPatientId(),
                prescription.getSerialNumber(), null);
        return ledgerService.postEntries(type, prescription.getFacilityId(), actor.userId(), actor.name(), reason,
                prescription.getSerialNumber(), idempotencyKey, hashOf(type, prescription, entries), patientContext,
                entries);
    }

    private String hashOf(StockTransactionType type, Prescription prescription, List<EntryRequest> entries) {
        String canonical = type + "|" + prescription.getId() + "|" + entries.stream()
                .map(entry -> entry.productId() + ":" + entry.batchId() + ":" + entry.locationId() + ":"
                        + entry.bucket() + ":" + entry.quantityDelta())
                .collect(Collectors.joining(","));
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }
}
