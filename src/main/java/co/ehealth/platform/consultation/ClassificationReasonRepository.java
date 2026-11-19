package co.ehealth.platform.consultation;

import co.ehealth.platform.visit.ServiceStream;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface ClassificationReasonRepository extends JpaRepository<ClassificationReason, UUID> {
    List<ClassificationReason> findByServiceStreamAndActiveTrueOrderBySortOrderAscLabelAsc(ServiceStream stream);
    List<ClassificationReason> findByServiceStreamOrderBySortOrderAscLabelAsc(ServiceStream stream);
    List<ClassificationReason> findByIdInAndServiceStreamAndActiveTrue(Iterable<UUID> ids, ServiceStream stream);
}
