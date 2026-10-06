package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class PharmacyProductService {

    public static final int MAX_PAGE_SIZE = 100;

    private final PharmacyProductRepository productRepository;
    private final PharmacyFacilityProductRepository facilityProductRepository;
    private final PharmacyStockAccountRepository stockAccountRepository;
    private final Clock clock;

    public PharmacyProductService(PharmacyProductRepository productRepository,
                                   PharmacyFacilityProductRepository facilityProductRepository,
                                   PharmacyStockAccountRepository stockAccountRepository, Clock clock) {
        this.productRepository = productRepository;
        this.facilityProductRepository = facilityProductRepository;
        this.stockAccountRepository = stockAccountRepository;
        this.clock = clock;
    }

    public Page<PharmacyProduct> search(String search, boolean activeOnly, int page, int size) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), boundedSize, Sort.by(Sort.Direction.ASC, "displayName"));
        return productRepository.search(search == null ? "" : search.trim(), activeOnly, pageable);
    }

    public PharmacyProduct get(UUID productId) {
        return productRepository.findById(productId).orElseThrow(PharmacyProductNotFoundException::new);
    }

    // Product creation never moves quantity (rule 1) — a fresh product
    // always starts with zero stock accounts. facilityId is required so
    // the very first assortment entry exists immediately (plan section 4's
    // add workflow step 5) rather than leaving a product uncatalogued
    // anywhere until a second, separate call.
    @Transactional
    public PharmacyProduct create(String code, String displayName, String genericName, String strength,
                                   String dosageForm, StockCategory category, StockBaseUnit baseUnit,
                                   Integer packSize, String barcode, String manufacturer, boolean batchTracked,
                                   boolean expiryTracked, String storageInstructions, UUID facilityId,
                                   Integer reorderThreshold, Integer targetQuantity, UUID actorUserId,
                                   String actorName) {
        if (productRepository.findByCodeNormalized(code).isPresent()) {
            throw new DuplicateProductCodeException(code);
        }
        Instant now = clock.instant();
        PharmacyProduct product = productRepository.save(new PharmacyProduct(code, displayName, genericName,
                strength, dosageForm, category, baseUnit, packSize, barcode, manufacturer, batchTracked,
                expiryTracked, storageInstructions, actorUserId, actorName, now));
        facilityProductRepository.save(new PharmacyFacilityProduct(product.getId(), facilityId, reorderThreshold,
                targetQuantity, now));
        return product;
    }

    // Metadata only — baseUnit/batchTracked/expiryTracked are frozen after
    // creation (PharmacyProduct.updateDetails()'s own why-note); a material
    // change to any of those needs a new product, not an edit here.
    @Transactional
    public PharmacyProduct updateDetails(UUID productId, String displayName, String genericName, String strength,
                                          String dosageForm, Integer packSize, String barcode, String manufacturer,
                                          String storageInstructions, UUID actorUserId, String actorName) {
        PharmacyProduct product = get(productId);
        product.updateDetails(displayName, genericName, strength, dosageForm, packSize, barcode, manufacturer,
                storageInstructions, actorUserId, actorName, clock.instant());
        return productRepository.save(product);
    }

    // plan section 4: "Before archiving require no physical balance in any
    // bucket..." — Phase 1 has no in-transit/mapped-obligation concepts
    // yet, so this checks physical balance only (ProductHasStockException's
    // own why-note).
    @Transactional
    public PharmacyProduct archive(UUID productId, UUID actorUserId, String actorName) {
        PharmacyProduct product = get(productId);
        List<PharmacyStockAccount> accounts = stockAccountRepository.findByProductId(productId);
        boolean hasStock = accounts.stream().anyMatch(a -> a.getQuantity() > 0);
        if (hasStock) {
            throw new ProductHasStockException();
        }
        product.archive(actorUserId, actorName, clock.instant());
        return productRepository.save(product);
    }

    @Transactional
    public PharmacyProduct reactivate(UUID productId, UUID actorUserId, String actorName) {
        PharmacyProduct product = get(productId);
        product.reactivate(actorUserId, actorName, clock.instant());
        return productRepository.save(product);
    }

    public PharmacyFacilityProduct getOrCreateAssortment(UUID productId, UUID facilityId, Integer reorderThreshold,
                                                          Integer targetQuantity) {
        return facilityProductRepository.findByProductIdAndFacilityId(productId, facilityId)
                .orElseGet(() -> facilityProductRepository.save(new PharmacyFacilityProduct(productId, facilityId,
                        reorderThreshold, targetQuantity, clock.instant())));
    }

    public List<PharmacyFacilityProduct> listAssortment(UUID facilityId) {
        return facilityProductRepository.findByFacilityIdAndActiveTrue(facilityId);
    }
}
