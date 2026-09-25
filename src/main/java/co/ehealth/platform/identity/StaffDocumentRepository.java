package co.ehealth.platform.identity;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StaffDocumentRepository extends JpaRepository<StaffDocument, UUID> {

    List<StaffDocument> findByUserIdOrderByUploadedAtDesc(UUID userId);
}
