package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.Prescription;
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
// prescription serial is the transaction's source reference and the patient
// is linked on the row, which is what the patient-linked ledger history
// reads. Runs inside the caller's transaction, so the stock movement and the
// dispensing record commit or roll back together (STK-11).
@Component
public class PatientLedgerPoster {

    private final PharmacyStockLedgerService ledgerService;
    private final LedgerPatientLinkRepository patientLinkRepository;

    public PatientLedgerPoster(PharmacyStockLedgerService ledgerService,
                                LedgerPatientLinkRepository patientLinkRepository) {
        this.ledgerService = ledgerService;
        this.patientLinkRepository = patientLinkRepository;
    }

    // idempotencyKey is derived from the prescription item and the attempt
    // (callers pass the quantity already dispensed/returned), so a replayed
    // request returns the original transaction instead of moving stock twice.
    public PharmacyStockTransaction post(StockTransactionType type, Prescription prescription,
                                          DispensingActor actor, String reason, String idempotencyKey,
                                          List<EntryRequest> entries) {
        PharmacyStockTransaction transaction = ledgerService.postEntries(type, prescription.getFacilityId(),
                actor.userId(), actor.name(), reason, prescription.getSerialNumber(), idempotencyKey,
                hashOf(type, prescription, entries), entries);
        patientLinkRepository.link(transaction.getId(), prescription.getPatientId(), prescription.getId());
        return transaction;
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
