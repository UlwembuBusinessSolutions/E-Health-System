package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ScheduleRegisterQueryService {

    public static final int MAX_PAGE_SIZE = 100;

    private final ScheduleRegisterEntryRepository entryRepository;
    private final PharmacyProductRepository productRepository;

    public ScheduleRegisterQueryService(ScheduleRegisterEntryRepository entryRepository,
                                        PharmacyProductRepository productRepository) {
        this.entryRepository = entryRepository;
        this.productRepository = productRepository;
    }

    // Newest first. Every entry already carries the running balance it
    // produced, so nothing is recomputed on read; currentBalance is the
    // latest of those, and is only given when a single product is asked for.
    @Transactional(readOnly = true)
    public ScheduleRegisterPageResponse list(UUID facilityId, UUID productId, int page, int size) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Page<ScheduleRegisterEntry> entries = entryRepository.findRegister(facilityId, productId,
                PageRequest.of(Math.max(page, 0), boundedSize, Sort.unsorted()));
        Map<UUID, PharmacyProduct> products = productsOf(entries.getContent());
        List<RegisterEntryResponse> items = entries.getContent().stream()
                .map(entry -> RegisterEntryResponse.from(entry, products.get(entry.getProductId())))
                .toList();
        return ScheduleRegisterPageResponse.of(currentBalanceFor(facilityId, productId), items, entries);
    }

    @Transactional(readOnly = true)
    public RegisterEntryResponse entry(ScheduleRegisterEntry entry) {
        PharmacyProduct product = productRepository.findById(entry.getProductId()).orElseThrow();
        return RegisterEntryResponse.from(entry, product);
    }

    private Long currentBalanceFor(UUID facilityId, UUID productId) {
        if (productId == null) {
            return null;
        }
        return entryRepository.findFirstByFacilityIdAndProductIdOrderBySeqDesc(facilityId, productId)
                .map(ScheduleRegisterEntry::getBalanceAfter)
                .orElse(0L);
    }

    private Map<UUID, PharmacyProduct> productsOf(List<ScheduleRegisterEntry> entries) {
        List<UUID> productIds = entries.stream().map(ScheduleRegisterEntry::getProductId).distinct().toList();
        return productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(PharmacyProduct::getId, Function.identity()));
    }
}
