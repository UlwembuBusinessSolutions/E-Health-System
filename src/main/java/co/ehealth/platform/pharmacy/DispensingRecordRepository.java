package co.ehealth.platform.pharmacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DispensingRecordRepository extends JpaRepository<DispensingRecord, UUID> {
}
