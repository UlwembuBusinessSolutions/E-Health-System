package co.ehealth.platform.pharmacy.csvimport;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImportBatchRepository extends JpaRepository<ImportBatch, UUID> {

    // Undo takes this lock first so two people pressing Undo serialise:
    // the second one then sees UNDONE and stops.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM ImportBatch b WHERE b.id = :id")
    Optional<ImportBatch> findByIdForUpdate(@Param("id") UUID id);

    List<ImportBatch> findTop20ByFacilityIdOrderByCreatedAtDesc(UUID facilityId);
}
