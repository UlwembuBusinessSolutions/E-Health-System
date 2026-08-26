package co.ehealth.platform.patient;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PatientRepository extends JpaRepository<Patient, UUID> {

    boolean existsByIdNumber(String idNumber);

    boolean existsByPassportNumber(String passportNumber);

    @Query(value = "SELECT nextval('patient_mpi_seq')", nativeQuery = true)
    long nextMpiSequenceValue();

    @Query("""
            SELECT p
            FROM Patient p
            WHERE
                (
                    :query <> ''
                    AND (
                        LOWER(p.firstName) LIKE LOWER(CONCAT('%', :query, '%'))
                        OR LOWER(p.lastName) LIKE LOWER(CONCAT('%', :query, '%'))
                        OR LOWER(p.mpiNumber) LIKE LOWER(CONCAT(:query, '%'))
                        OR (p.idNumber IS NOT NULL AND p.idNumber LIKE CONCAT('%', :query, '%'))
                        OR (p.passportNumber IS NOT NULL AND UPPER(p.passportNumber) LIKE UPPER(CONCAT('%', :query, '%')))
                    )
                )
                OR p.dateOfBirth = :dateOfBirth
            ORDER BY
                CASE
                    WHEN LOWER(p.mpiNumber) = LOWER(:query) THEN 1
                    WHEN p.idNumber = :query THEN 2
                    WHEN UPPER(p.passportNumber) = UPPER(:query) THEN 2
                    WHEN LOWER(p.firstName) = LOWER(:query) THEN 3
                    WHEN LOWER(p.lastName) = LOWER(:query) THEN 4
                    WHEN LOWER(p.firstName) LIKE LOWER(CONCAT(:query, '%')) THEN 5
                    WHEN LOWER(p.lastName) LIKE LOWER(CONCAT(:query, '%')) THEN 6
                    ELSE 7
                END,
                p.lastName,
                p.firstName
            """)
    List<Patient> search(
            @Param("query") String query,
            @Param("dateOfBirth") LocalDate dateOfBirth);
}
