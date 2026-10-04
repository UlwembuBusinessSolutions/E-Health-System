package co.ehealth.platform.pharmacy.dispensing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PrescriptionCollectionRepository extends JpaRepository<PrescriptionCollection, UUID> {
}
