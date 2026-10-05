package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OfflineSyncRecordRepository extends JpaRepository<OfflineSyncRecord, UUID> {

    Optional<OfflineSyncRecord> findByClientRecordId(UUID clientRecordId);

    List<OfflineSyncRecord> findByStatusInOrderByReceivedAtAsc(Collection<OfflineSyncStatus> statuses);
}