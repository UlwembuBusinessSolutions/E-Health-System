package co.ehealth.platform.facility;

// lihle | 2026-09-09 | Limited clinic discovery to accessible active facilities so dropdowns respect staff assignments.

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FacilityRepository extends JpaRepository<Facility, UUID> {
    List<Facility> findByActiveTrue();

    @org.springframework.data.jpa.repository.Query(value = "select f.* from facilities f where f.active = true "
            + "and (exists (select 1 from user_facilities uf where uf.user_id = :userId and uf.facility_id = f.id) "
            + "or exists (select 1 from user_roles ur where ur.user_id = :userId and ur.facility_id is null)) "
            + "order by f.name, f.id", nativeQuery = true)
    List<Facility> findAccessible(@org.springframework.data.repository.query.Param("userId") UUID userId);

    boolean existsByCode(String code);
}
