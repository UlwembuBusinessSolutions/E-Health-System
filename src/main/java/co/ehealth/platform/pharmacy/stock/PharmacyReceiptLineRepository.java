package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PharmacyReceiptLineRepository extends JpaRepository<PharmacyReceiptLine, UUID> {
    List<PharmacyReceiptLine> findByReceiptId(UUID receiptId);
}
