package co.ehealth.platform.facility;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface DepartmentRepository extends JpaRepository<Department, UUID> {
    List<Department> findByFacilityIdOrderByName(UUID facilityId);
    Optional<Department> findByIdAndFacilityId(UUID id, UUID facilityId);
}
