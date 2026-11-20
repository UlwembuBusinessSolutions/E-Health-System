package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ReferralNotificationAcknowledgementRepository
        extends JpaRepository<ReferralNotificationAcknowledgement, UUID> {

    @Modifying
    @Query(value = "insert into control.referral_notification_acknowledgements "
            + "(notification_id, user_id, acknowledged_at) "
            + "values (:notificationId, :userId, :acknowledgedAt) "
            + "on conflict (notification_id, user_id) do nothing", nativeQuery = true)
    void acknowledge(@Param("notificationId") UUID notificationId, @Param("userId") UUID userId,
                     @Param("acknowledgedAt") Instant acknowledgedAt);

    @Query("select acknowledgement.notificationId from ReferralNotificationAcknowledgement acknowledgement "
            + "where acknowledgement.userId = :userId "
            + "and acknowledgement.notificationId in :notificationIds")
    List<UUID> findAcknowledgedNotificationIds(@Param("userId") UUID userId,
                                               @Param("notificationIds") List<UUID> notificationIds);
}
