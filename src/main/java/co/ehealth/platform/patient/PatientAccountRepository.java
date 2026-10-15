package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PatientAccountRepository extends JpaRepository<PatientAccount, UUID> {

    Optional<PatientAccount> findByEmail(String email);

    // The reconciliation lookup both PatientService.register() (reception
    // path) and PatientAuthService.register() (self-service path) key off
    // — id_number is unique per tenant, same matching key Patient itself
    // uses (PatientRepository.findByIdNumber's own precedent).
    Optional<PatientAccount> findByIdNumber(String idNumber);

    boolean existsByEmail(String email);
}
