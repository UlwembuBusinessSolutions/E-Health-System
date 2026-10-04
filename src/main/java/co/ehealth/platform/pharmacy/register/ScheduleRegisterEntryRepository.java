package co.ehealth.platform.pharmacy.register;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

// Deliberately not a JpaRepository: the register is append-only, so the
// only write offered is save() of a new entry. There is nothing here that
// could update or delete one.
public interface ScheduleRegisterEntryRepository extends Repository<ScheduleRegisterEntry, UUID> {

    ScheduleRegisterEntry save(ScheduleRegisterEntry entry);

    boolean existsByFacilityIdAndProductId(UUID facilityId, UUID productId);

    Optional<ScheduleRegisterEntry> findFirstByFacilityIdAndProductIdOrderBySeqDesc(UUID facilityId, UUID productId);

    // The newest entry of each given product, in one query.
    @Query("SELECT e FROM ScheduleRegisterEntry e WHERE e.facilityId = :facilityId "
            + "AND e.productId IN :productIds AND e.seq = (SELECT MAX(latest.seq) FROM ScheduleRegisterEntry latest "
            + "WHERE latest.facilityId = e.facilityId AND latest.productId = e.productId)")
    List<ScheduleRegisterEntry> findLatestEntries(@Param("facilityId") UUID facilityId,
                                                  @Param("productIds") Collection<UUID> productIds);

    Optional<ScheduleRegisterEntry> findFirstByFacilityIdAndProductIdAndEntryAtLessThanOrderBySeqDesc(
            UUID facilityId, UUID productId, Instant before);

    List<ScheduleRegisterEntry> findByFacilityIdAndProductIdAndEntryAtGreaterThanEqualAndEntryAtLessThanOrderBySeqAsc(
            UUID facilityId, UUID productId, Instant from, Instant to);

    @Query("SELECT e FROM ScheduleRegisterEntry e WHERE e.facilityId = :facilityId "
            + "AND (:productId IS NULL OR e.productId = :productId) ORDER BY e.seq DESC")
    Page<ScheduleRegisterEntry> findRegister(@Param("facilityId") UUID facilityId,
                                             @Param("productId") UUID productId, Pageable pageable);
}
