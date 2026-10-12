package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PharmacyStockTransactionRepository extends JpaRepository<PharmacyStockTransaction, UUID> {
    Optional<PharmacyStockTransaction> findByIdempotencyKey(String idempotencyKey);

    boolean existsByReversalOfTransactionId(UUID reversalOfTransactionId);

    // Batched so the ledger page flags every reversed row with one query.
    List<PharmacyStockTransaction> findByReversalOfTransactionIdIn(Collection<UUID> transactionIds);
}
