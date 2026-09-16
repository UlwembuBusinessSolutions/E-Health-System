package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface PrescriptionDeclineNotificationRepository extends JpaRepository<PrescriptionDeclineNotification, UUID> {
    List<PrescriptionDeclineNotification> findByRecipientUserIdOrderByCreatedAtDesc(UUID recipientUserId);
}
