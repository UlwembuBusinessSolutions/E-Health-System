package co.ehealth.platform.patient;

import co.ehealth.platform.identity.Gender;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

// Deliberately no delete(...) call site anywhere in this codebase and no
// custom delete query here either — PREG-US-017's own why-note (Patient's
// class-level comment) on why that's enforced by omission.
public interface PatientRepository extends JpaRepository<Patient, UUID> {

    boolean existsByIdNumber(String idNumber);

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
    // PREG-US-018 AC1 — archived patients are "removed from active
    // operational lists"; the parenthesized OR group is the original
    // multi-identifier match, AND-ed with the archived exclusion rather than
    // folded into it, so an archived patient can't sneak back in via a name
    // or MPI match.
    @Query("SELECT p FROM Patient p WHERE "
            + "p.archived = FALSE AND ("
            + "LOWER(p.firstName) LIKE LOWER(CONCAT('%', :query, '%')) "
            + "OR LOWER(p.lastName) LIKE LOWER(CONCAT('%', :query, '%')) "
            + "OR p.mpiNumber = :query OR p.idNumber = :query) "
            + "ORDER BY p.lastName, p.firstName")
    List<Patient> search(@Param("query") String query);

    // PatientService.list()'s roster view — every param here is optional
    // (null/blank = don't filter on that column at all); Spring Data
    // appends the ORDER BY from Pageable's own Sort onto this JPQL query
    // automatically, so callers control ordering without a second query
    // method per sort key. mpiNumber is a substring match (a receptionist
    // filtering the roster is more likely to remember a fragment than the
    // full "MPI-0000123", unlike /search's own exact-match branch for a
    // card that's been typed in full) rather than search()'s exact-only
    // check above. It's compared against '' rather than checked for NULL
    // like every other param here — PatientService.parseMpi()'s own
    // why-note: a NULL bound into LOWER(CONCAT(...)) makes Postgres unable
    // to infer the parameter's type ("function lower(bytea) does not
    // exist"), something that only bites this one param because it's the
    // only one used inside a function call rather than a plain equality.
    // createdFrom/createdTo hit a sibling version of the same class of bug
    // ("could not determine data type of parameter") for a null Instant
    // bound into a bare "? IS NULL" with no other typed context in that
    // position — PatientService.NO_LOWER_BOUND/NO_UPPER_BOUND sidestep it
    // the same way: never bind null there either, use dates so far outside
    // any real patient's createdAt that leaving the range unbounded and
    // comparing against a always-true sentinel are indistinguishable.
    // PREG-US-018 AC1 — same archived exclusion as search() above; the
    // default roster is the *active* roster.
    @Query("SELECT p FROM Patient p WHERE "
            + "p.archived = FALSE "
            + "AND (:gender IS NULL OR p.gender = :gender) "
            + "AND (:hasMedicalAid IS NULL "
            + "     OR (:hasMedicalAid = TRUE AND p.medicalAidProvider IS NOT NULL) "
            + "     OR (:hasMedicalAid = FALSE AND p.medicalAidProvider IS NULL)) "
            + "AND (:mpiNumber = '' OR LOWER(p.mpiNumber) LIKE LOWER(CONCAT('%', :mpiNumber, '%'))) "
            + "AND (:citizenshipStatus IS NULL OR p.citizenshipStatus = :citizenshipStatus) "
            + "AND p.createdAt >= :createdFrom AND p.createdAt <= :createdTo")
    Page<Patient> findFiltered(@Param("gender") Gender gender, @Param("hasMedicalAid") Boolean hasMedicalAid,
                                @Param("mpiNumber") String mpiNumber,
                                @Param("citizenshipStatus") CitizenshipStatus citizenshipStatus,
                                @Param("createdFrom") Instant createdFrom, @Param("createdTo") Instant createdTo,
                                Pageable pageable);
}
