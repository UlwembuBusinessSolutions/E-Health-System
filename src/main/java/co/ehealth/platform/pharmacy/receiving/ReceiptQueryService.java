package co.ehealth.platform.pharmacy.receiving;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyReceipt;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptLine;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptLineRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyReceiptRepository;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplierRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// The read side of receiving: receipt list and detail, with line state worked
// out from the ledger. Every figure for a page of receipts comes from a fixed
// number of batched queries — lines, products, suppliers, ledger usage — never
// one query per receipt.
@Service
public class ReceiptQueryService {

    public static final int MAX_PAGE_SIZE = 100;
    private static final Instant FAR_FUTURE = Instant.parse("9999-01-01T00:00:00Z");

    private final PharmacyReceiptRepository receiptRepository;
    private final PharmacyReceiptLineRepository receiptLineRepository;
    private final PharmacyProductRepository productRepository;
    private final PharmacySupplierRepository supplierRepository;
    private final ReceiptUsageLookup usageLookup;
    private final Clock clock;

    public ReceiptQueryService(PharmacyReceiptRepository receiptRepository,
                               PharmacyReceiptLineRepository receiptLineRepository,
                               PharmacyProductRepository productRepository,
                               PharmacySupplierRepository supplierRepository, ReceiptUsageLookup usageLookup,
                               Clock clock) {
        this.receiptRepository = receiptRepository;
        this.receiptLineRepository = receiptLineRepository;
        this.productRepository = productRepository;
        this.supplierRepository = supplierRepository;
        this.usageLookup = usageLookup;
        this.clock = clock;
    }

    public record ReceiptSummaryView(PharmacyReceipt receipt, String supplierName, int lineCount, long totalUnits,
                                     boolean usedStock) {
    }

    public record ReceiptLineView(PharmacyReceiptLine line, PharmacyProduct product, ReceiptLineState state) {
    }

    public record ReceiptDetailView(ReceiptSummaryView summary, List<ReceiptLineView> lines) {
    }

    public Page<ReceiptSummaryView> list(UUID facilityId, UUID supplierId, String search, LocalDate from,
                                         LocalDate to, int page, int size) {
        int boundedSize = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        Instant fromInclusive = from == null ? Instant.EPOCH : startOfDay(from);
        Instant toExclusive = to == null ? FAR_FUTURE : startOfDay(to.plusDays(1));
        Page<PharmacyReceipt> receipts = receiptRepository.search(facilityId, supplierId,
                search == null ? "" : search.trim(), fromInclusive, toExclusive,
                PageRequest.of(Math.max(page, 0), boundedSize));
        List<ReceiptSummaryView> views = summarise(receipts.getContent()).stream()
                .map(ReceiptDetailView::summary).toList();
        return new PageImpl<>(views, receipts.getPageable(), receipts.getTotalElements());
    }

    public ReceiptDetailView get(UUID receiptId) {
        PharmacyReceipt receipt = receiptRepository.findById(receiptId).orElseThrow(ReceiptNotFoundException::new);
        return summarise(List.of(receipt)).get(0);
    }

    private Instant startOfDay(LocalDate date) {
        return date.atStartOfDay(clock.getZone()).toInstant();
    }

    private List<ReceiptDetailView> summarise(List<PharmacyReceipt> receipts) {
        if (receipts.isEmpty()) {
            return List.of();
        }
        List<UUID> receiptIds = receipts.stream().map(PharmacyReceipt::getId).toList();
        List<PharmacyReceiptLine> allLines = receiptLineRepository.findByReceiptIdIn(receiptIds);
        Map<UUID, List<PharmacyReceiptLine>> linesByReceipt = allLines.stream()
                .collect(Collectors.groupingBy(PharmacyReceiptLine::getReceiptId));
        Map<UUID, PharmacyProduct> productsById = loadProducts(allLines);
        Map<UUID, PharmacySupplier> suppliersById = loadSuppliers(receipts);
        Map<UUID, Integer> usedByLineId = usageLookup.usedQuantityByLineId(receipts, allLines);

        return receipts.stream().map(receipt -> {
            List<PharmacyReceiptLine> lines = linesByReceipt.getOrDefault(receipt.getId(), List.of());
            List<ReceiptLineView> lineViews = lines.stream()
                    .map(line -> new ReceiptLineView(line, productsById.get(line.getProductId()),
                            ReceiptLineState.of(receipt.isReversed(), usedByLineId.getOrDefault(line.getId(), 0))))
                    .toList();
            boolean usedStock = lines.stream().anyMatch(line -> usedByLineId.containsKey(line.getId()));
            long totalUnits = lines.stream().mapToLong(PharmacyReceiptLine::getBaseQuantity).sum();
            ReceiptSummaryView summary = new ReceiptSummaryView(receipt,
                    displayedSupplierName(receipt, suppliersById), lines.size(), totalUnits, usedStock);
            return new ReceiptDetailView(summary, lineViews);
        }).toList();
    }

    private Map<UUID, PharmacyProduct> loadProducts(Collection<PharmacyReceiptLine> lines) {
        List<UUID> productIds = lines.stream().map(PharmacyReceiptLine::getProductId).distinct().toList();
        return productRepository.findAllById(productIds).stream()
                .collect(Collectors.toMap(PharmacyProduct::getId, Function.identity()));
    }

    private Map<UUID, PharmacySupplier> loadSuppliers(Collection<PharmacyReceipt> receipts) {
        List<UUID> supplierIds = receipts.stream().map(PharmacyReceipt::getSupplierId)
                .filter(id -> id != null).distinct().toList();
        return supplierRepository.findAllById(supplierIds).stream()
                .collect(Collectors.toMap(PharmacySupplier::getId, Function.identity()));
    }

    // The supplier's current name when the receipt is linked to one (so a
    // merge shows the surviving name); otherwise what was typed at the time.
    private String displayedSupplierName(PharmacyReceipt receipt, Map<UUID, PharmacySupplier> suppliersById) {
        PharmacySupplier supplier = suppliersById.get(receipt.getSupplierId());
        return supplier != null ? supplier.getName() : receipt.getSupplierName();
    }
}
