package co.ehealth.platform.visit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface QueueTokenEventRepository extends JpaRepository<QueueTokenEvent, UUID> {

    List<QueueTokenEvent> findByTokenIdOrderByOccurredAtAsc(UUID tokenId);
}
