package co.ehealth.platform.pharmacy.csvimport;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ImportBatchItemRepository extends JpaRepository<ImportBatchItem, UUID> {

    List<ImportBatchItem> findByBatchId(UUID batchId);
}
