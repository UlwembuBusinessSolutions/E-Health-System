package co.ehealth.platform.pharmacy.supplier;

import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SupplierService {

    public static final int MAX_PAGE_SIZE = 100;

    private final PharmacySupplierRepository supplierRepository;
    private final PharmacySupplierProductRepository supplierProductRepository;
    private final SupplierDuplicateDetector duplicateDetector;
    private final Clock clock;

    public SupplierService(PharmacySupplierRepository supplierRepository,
                           PharmacySupplierProductRepository supplierProductRepository,
                           SupplierDuplicateDetector duplicateDetector, Clock clock) {
        this.supplierRepository = supplierRepository;
        this.supplierProductRepository = supplierProductRepository;
        this.duplicateDetector = duplicateDetector;
        this.clock = clock;
    }

    public Page<PharmacySupplier> search(String search, SupplierStatus status, int page, int size) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        String trimmedSearch = search == null ? "" : search.trim();
        // Asking for ARCHIVED explicitly is how the UI reaches merged-away
        // suppliers; the default list stays free of them.
        boolean includeMerged = status == SupplierStatus.ARCHIVED;
        return supplierRepository.search(trimmedSearch, status, includeMerged,
                PageRequest.of(Math.max(page, 0), boundedSize));
    }

    // One grouped query for the whole page of suppliers instead of a count per row.
    public Map<UUID, Long> productCounts(Collection<UUID> supplierIds) {
        if (supplierIds.isEmpty()) {
            return Map.of();
        }
        return supplierProductRepository.countBySupplierIds(supplierIds).stream()
                .collect(Collectors.toMap(PharmacySupplierProductRepository.ProductCount::supplierId,
                        PharmacySupplierProductRepository.ProductCount::productCount));
    }

    public PharmacySupplier get(UUID supplierId) {
        return supplierRepository.findById(supplierId).orElseThrow(SupplierNotFoundException::new);
    }

    @Transactional
    public PharmacySupplier create(String name, String phone, String email, boolean confirmDistinct,
                                   UUID actorUserId) {
        String cleanName = requireName(name);
        rejectDuplicate(cleanName, supplierRepository.findAll(), confirmDistinct);
        return supplierRepository.save(new PharmacySupplier(cleanName, blankToNull(phone), blankToNull(email),
                actorUserId, clock.instant()));
    }

    // name == null means "leave the name alone"; the duplicate check only runs
    // when the normalised name really changes, so fixing a typo in the phone
    // number never trips over the supplier's own record.
    @Transactional
    public PharmacySupplier update(UUID supplierId, String name, String phone, String email,
                                   boolean confirmDistinct) {
        PharmacySupplier supplier = get(supplierId);
        String newName = name == null ? supplier.getName() : requireName(name);
        if (!SupplierNameKey.of(newName).equals(supplier.getNameKey())) {
            List<PharmacySupplier> others = supplierRepository.findAll().stream()
                    .filter(other -> !other.getId().equals(supplierId))
                    .toList();
            rejectDuplicate(newName, others, confirmDistinct);
        }
        supplier.updateDetails(newName, blankToNull(phone), blankToNull(email), clock.instant());
        return supplierRepository.save(supplier);
    }

    @Transactional
    public PharmacySupplier archive(UUID supplierId) {
        PharmacySupplier supplier = get(supplierId);
        supplier.archive(clock.instant());
        return supplierRepository.save(supplier);
    }

    @Transactional
    public PharmacySupplier reactivate(UUID supplierId) {
        PharmacySupplier supplier = get(supplierId);
        if (supplier.wasMerged()) {
            throw new InvalidSupplierStateException("\"" + supplier.getName()
                    + "\" was merged into another supplier and can't be reactivated. Use the supplier it was merged into.");
        }
        supplier.reactivate(clock.instant());
        return supplierRepository.save(supplier);
    }

    private void rejectDuplicate(String name, Collection<PharmacySupplier> existingSuppliers,
                                 boolean confirmDistinct) {
        duplicateDetector.findMatch(SupplierNameKey.of(name), existingSuppliers).ifPresent(match -> {
            boolean clientConfirmedItIsDifferent = match.similar() && confirmDistinct;
            if (!clientConfirmedItIsDifferent) {
                throw new DuplicateSupplierException(match.supplier().getId(), match.supplier().getName(),
                        match.similar());
            }
        });
    }

    private static String requireName(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (SupplierNameKey.of(trimmed).isEmpty()) {
            throw new PharmacyValidationException("Enter the supplier's name.");
        }
        return trimmed;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
