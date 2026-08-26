package co.ehealth.platform.facility;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FacilityRepository extends JpaRepository<Facility, UUID> {
    List<Facility> findByActiveTrue();

    boolean existsByCode(String code);
}
