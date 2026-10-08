package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

// Used only to take a row lock on the product, which serializes register
// writes for that product. Without it two simultaneous dispenses could both
// read the same balance and together take the register below zero.
public interface RegisterProductLockRepository extends Repository<PharmacyProduct, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM PharmacyProduct p WHERE p.id = :productId")
    Optional<PharmacyProduct> lockProduct(@Param("productId") UUID productId);
}
