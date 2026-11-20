package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReferralNotificationRepository extends JpaRepository<ReferralNotification, UUID> {

    @Query("""
            select notification from ReferralNotification notification
            where notification.destinationOrganizationId = :organizationId
              and notification.destinationFacilityId in :facilityIds
            order by notification.createdAt
            """)
    List<ReferralNotification> findForUser(@Param("organizationId") UUID organizationId,
                                           @Param("facilityIds") List<UUID> facilityIds);

    Optional<ReferralNotification> findByIdAndDestinationOrganizationIdAndDestinationFacilityIdIn(
            UUID id, UUID organizationId, List<UUID> facilityIds);

    boolean existsBySourceSchemaAndSourceReferralId(String sourceSchema, UUID sourceReferralId);
}
