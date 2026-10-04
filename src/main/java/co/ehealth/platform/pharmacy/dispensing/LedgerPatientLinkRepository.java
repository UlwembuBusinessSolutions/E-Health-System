package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

// Stamps the patient and prescription onto a ledger transaction right after
// it is posted. A native UPDATE on purpose: the stock package's
// PharmacyStockTransaction is an append-only entity that knows nothing
// about patients, and the link columns are only ever filled once, here, at
// posting time (the WHERE clause refuses to overwrite an existing link).
public interface LedgerPatientLinkRepository extends Repository<PharmacyStockTransaction, UUID> {

    @Modifying(flushAutomatically = true)
    @Query(value = "UPDATE pharmacy_stock_transactions SET patient_id = :patientId, "
            + "prescription_id = :prescriptionId WHERE id = :transactionId AND patient_id IS NULL",
            nativeQuery = true)
    void link(@Param("transactionId") UUID transactionId, @Param("patientId") UUID patientId,
              @Param("prescriptionId") UUID prescriptionId);
}
