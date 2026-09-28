package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PharmacyStockTransactionRepository extends JpaRepository<PharmacyStockTransaction, UUID> {
    Optional<PharmacyStockTransaction> findByIdempotencyKey(String idempotencyKey);
}
