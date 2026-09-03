package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

// Deliberately no delete(...) call site anywhere in this codebase and no
// custom delete query here either — PREG-US-017's own why-note (Patient's
// class-level comment) on why that's enforced by omission.
public interface PatientRepository extends JpaRepository<Patient, UUID> {

    boolean existsByIdNumber(String idNumber);

    boolean existsByIdNumberAndIdNot(String idNumber, UUID id);

    // PatientService.register()'s MPI source — a real Postgres sequence,
    // not an application-side max()+1 or UUID substring: concurrent
    // registrations calling nextval() concurrently can never receive the
    // same value, which is exactly PREG-US-002's "unique within the tenant
    // ... generated" requirement under real concurrent load, not just in
    // the common case.
    @Query(value = "SELECT nextval('patient_mpi_seq')", nativeQuery = true)
    long nextMpiSequenceValue();

    // PREG-US-008's "multi-identifier search" — name (case-insensitive
    // substring, matching how a receptionist actually remembers a name) or
    // an exact MPI/ID number match (typed off a card or ID document, never
    // partial). ILIKE over LIKE + lower() so idx_patients_name's expression
    // index actually gets used for the name branch.
    @Query("SELECT p FROM Patient p WHERE "
            + "LOWER(p.firstName) LIKE LOWER(CONCAT('%', :query, '%')) "
            + "OR LOWER(p.lastName) LIKE LOWER(CONCAT('%', :query, '%')) "
            + "OR p.mpiNumber = :query OR p.idNumber = :query "
            + "ORDER BY p.lastName, p.firstName")
    List<Patient> search(@Param("query") String query);
}
