package co.ehealth.platform.diagnosis;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DiagnosisRepository extends JpaRepository<Diagnosis, UUID> {

    Optional<Diagnosis> findByNameKey(String nameKey);

    // Typing "j20" finds the code, typing "bronch" finds the name. Exact code first, then names that
    // start with the text, then codes that start with it, then names that merely contain it.
    @Query(value = "SELECT * FROM diagnoses WHERE active AND (name_key LIKE :contains OR lower(code) LIKE :codePrefix) "
            + "ORDER BY CASE WHEN lower(code) = :exact THEN 0 WHEN name_key LIKE :namePrefix THEN 1 "
            + "WHEN lower(code) LIKE :codePrefix THEN 2 ELSE 3 END, name_key LIMIT :max", nativeQuery = true)
    List<Diagnosis> search(@Param("contains") String contains, @Param("namePrefix") String namePrefix,
                           @Param("codePrefix") String codePrefix, @Param("exact") String exact, @Param("max") int max);

    interface Count {
        UUID getDiagnosisId();

        String getCode();

        String getName();

        String getSource();

        long getTotal();
    }

    // How often each diagnosis was recorded on consultations signed in the period. A consultation that carries
    // on from an earlier one starts with a copy of its diagnoses, so a diagnosis it only inherited is not
    // counted a second time: one episode of care counts once.
    @Query(value = "SELECT d.id AS diagnosisId, d.code AS code, d.name AS name, d.source AS source, count(*) AS total "
            + "FROM consultation_diagnoses cd "
            + "JOIN consultations c ON c.id = cd.consultation_id "
            + "JOIN diagnoses d ON d.id = cd.diagnosis_id "
            + "WHERE c.status = 'SIGNED' AND c.signed_at >= :from AND c.signed_at < :to "
            + "AND NOT EXISTS (SELECT 1 FROM consultation_diagnoses inherited "
            + "WHERE inherited.consultation_id = c.continued_from_consultation_id "
            + "AND inherited.diagnosis_id = cd.diagnosis_id) "
            + "GROUP BY d.id, d.code, d.name, d.source ORDER BY total DESC, d.name", nativeQuery = true)
    List<Count> countsBetween(@Param("from") Instant from, @Param("to") Instant to);
}
