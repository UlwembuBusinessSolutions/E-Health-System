package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface PrescriptionQueryNotificationRepository extends JpaRepository<PrescriptionQueryNotification, UUID> {
    List<PrescriptionQueryNotification> findByRecipientUserIdOrderByCreatedAtDesc(UUID recipientUserId);
}
