package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PatientReferralEventRepository extends JpaRepository<PatientReferralEvent, UUID> {
    List<PatientReferralEvent> findByReferralIdOrderByOccurredAtAsc(UUID referralId);
}
