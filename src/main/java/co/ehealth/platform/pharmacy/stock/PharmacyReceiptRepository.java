package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PharmacyReceiptRepository extends JpaRepository<PharmacyReceipt, UUID> {
    // Idempotent-retry lookup — PharmacyReceiptService.receive()'s own
    // why-note: when postEntries() returns an already-posted transaction
    // (same idempotency key replayed), this is how the retry finds the
    // original receipt instead of creating a second one.
    Optional<PharmacyReceipt> findByTransactionId(UUID transactionId);
}
