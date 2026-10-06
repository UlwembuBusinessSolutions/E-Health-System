package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PharmacyProductRepository extends JpaRepository<PharmacyProduct, UUID> {

    // code_normalized is a generated column (UPPER(TRIM(code))) — matching
    // against it here, not a derived findByCode(), keeps normalization in
    // exactly one place (the migration's own generated-column definition)
    // rather than trusting every Java caller to upper-case/trim first.
    @Query(value = "SELECT * FROM pharmacy_products WHERE code_normalized = UPPER(TRIM(:code))", nativeQuery = true)
    Optional<PharmacyProduct> findByCodeNormalized(@Param("code") String code);

    // search is never passed as a real null (PharmacyProductService.search()'s
    // own why-note) — an untyped null bind parameter inside a CONCAT/LOWER
    // expression makes PostgreSQL infer it as bytea rather than text at
    // prepare time (a Hibernate/PG parameter-type-inference quirk,
    // regardless of the "OR" that would otherwise short-circuit it at
    // runtime), which fails with "function lower(bytea) does not exist"
    // before a single row is ever read. Using '' as the empty-search
    // sentinel here sidesteps that entirely.
    @Query("SELECT p FROM PharmacyProduct p WHERE "
            + "(:activeOnly = false OR p.active = true) AND "
            + "(:search = '' OR LOWER(p.displayName) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(p.code) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(COALESCE(p.genericName, '')) LIKE LOWER(CONCAT('%', :search, '%')) "
            + "OR LOWER(COALESCE(p.barcode, '')) LIKE LOWER(CONCAT('%', :search, '%'))) "
            + "ORDER BY p.displayName ASC")
    Page<PharmacyProduct> search(@Param("search") String search, @Param("activeOnly") boolean activeOnly,
                                  Pageable pageable);
}
