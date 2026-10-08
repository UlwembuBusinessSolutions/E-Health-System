package co.ehealth.platform.pharmacy.prescribing;

import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.pharmacy.PurchaseReason;
import co.ehealth.platform.pharmacy.dispensing.LotAvailability;
import co.ehealth.platform.pharmacy.dispensing.StockLotReader;
import co.ehealth.platform.pharmacy.dispensing.StockPicture;
import co.ehealth.platform.pharmacy.dispensing.StockSnapshot;
import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.pharmacy.stock.PharmacyFacilityProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyFacilityProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProductService;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import co.ehealth.platform.pharmacy.stock.StockBaseUnit;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// What a prescriber needs to know about the pharmacy's shelf while writing a
// prescription: which medicines can be searched, how much of each can really
// be handed over today (expired lots do not count), what to offer instead
// when something is out, and the check that a prescription never asks the
// pharmacy for more than it holds.
@Service
public class PrescribingStockService {

    static final int MIN_QUERY_LENGTH = 2;
    private static final int MAX_RESULTS = 20;
    private static final int SEARCH_WINDOW = 60;
    private static final int MAX_ALTERNATIVES = 3;

    public enum StockLevel {
        IN_STOCK, LOW, OUT
    }

    public record Alternative(UUID productId, String name, long available) {
    }

    public record Medicine(UUID productId, String code, String name, String genericName, String strength,
                           String dosageForm, StockBaseUnit unit, Integer packSize, DrugSchedule schedule,
                           long available, StockLevel level, LocalDate nearestExpiry,
                           List<Alternative> alternatives) {
    }

    public record SearchResult(UUID facilityId, String facilityName, List<Medicine> medicines) {
    }

    // One medicine the prescriber wants handed over, by product.
    public record StockLine(UUID productId, int quantity) {
    }

    private final FacilityService facilityService;
    private final PharmacyProductService productService;
    private final PharmacyProductRepository productRepository;
    private final PharmacyFacilityProductRepository assortmentRepository;
    private final StockLotReader lotReader;

    public PrescribingStockService(FacilityService facilityService, PharmacyProductService productService,
                                   PharmacyProductRepository productRepository,
                                   PharmacyFacilityProductRepository assortmentRepository,
                                   StockLotReader lotReader) {
        this.facilityService = facilityService;
        this.productService = productService;
        this.productRepository = productRepository;
        this.assortmentRepository = assortmentRepository;
        this.lotReader = lotReader;
    }

    public SearchResult search(String query) {
        Facility pharmacy = facilityService.findPharmacyFacility();
        String text = query == null ? "" : query.trim();
        if (text.length() < MIN_QUERY_LENGTH) {
            return new SearchResult(pharmacy.getId(), pharmacy.getName(), List.of());
        }

        Map<UUID, PharmacyFacilityProduct> assortment = assortmentOf(pharmacy.getId());
        List<PharmacyProduct> matches = productService.search(text, true, 0, SEARCH_WINDOW).getContent().stream()
                .filter(product -> assortment.containsKey(product.getId()))
                .limit(MAX_RESULTS).toList();

        Map<UUID, List<PharmacyProduct>> candidatesByOutProduct = new LinkedHashMap<>();
        StockSnapshot shelf = lotReader.snapshot(Set.of(pharmacy.getId()),
                matches.stream().map(PharmacyProduct::getId).collect(Collectors.toSet()));
        for (PharmacyProduct match : matches) {
            if (shelf.shelf(pharmacy.getId(), match.getId()).usableTotal() == 0) {
                candidatesByOutProduct.put(match.getId(), sameGenericElsewhere(match, assortment));
            }
        }
        StockSnapshot alternativeShelf = lotReader.snapshot(Set.of(pharmacy.getId()), candidatesByOutProduct.values()
                .stream().flatMap(List::stream).map(PharmacyProduct::getId).collect(Collectors.toSet()));

        List<Medicine> medicines = matches.stream().map(product -> toMedicine(product, pharmacy.getId(), shelf,
                assortment.get(product.getId()),
                alternativesFor(candidatesByOutProduct.get(product.getId()), pharmacy.getId(), alternativeShelf)))
                .sorted(Comparator.comparing((Medicine medicine) -> medicine.level() == StockLevel.OUT)
                        .thenComparing(Medicine::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
        return new SearchResult(pharmacy.getId(), pharmacy.getName(), medicines);
    }

    // The rule behind "make sure it is on stock": the pharmacy must hold at
    // least what the whole prescription asks of each product. Lines for the
    // same product add up, and expired lots never count.
    public void requireCovered(UUID facilityId, List<StockLine> lines) {
        Map<UUID, Integer> askedByProduct = lines.stream().collect(
                Collectors.groupingBy(StockLine::productId, LinkedHashMap::new, Collectors.summingInt(StockLine::quantity)));
        if (askedByProduct.isEmpty()) {
            return;
        }
        Map<UUID, PharmacyProduct> products = productRepository.findAllById(askedByProduct.keySet()).stream()
                .collect(Collectors.toMap(PharmacyProduct::getId, Function.identity()));
        StockSnapshot shelf = lotReader.snapshot(Set.of(facilityId), askedByProduct.keySet());
        askedByProduct.forEach((productId, asked) -> {
            PharmacyProduct product = products.get(productId);
            if (product == null || !product.isActive()) {
                throw new PharmacyValidationException(
                        "One of the medicines you chose is no longer available. Search for it again.");
            }
            long available = shelf.shelf(facilityId, productId).usableTotal();
            if (available < asked) {
                throw new PharmacyValidationException(shortStockMessage(product.getDisplayName(), asked, available));
            }
        });
    }

    // Why a "patient buys this" line is there, worked out from the shelf at
    // the time. A medicine the pharmacy could fully cover must be dispensed
    // instead, otherwise the printed prescription would send a patient to buy
    // something that was on the shelf.
    public PurchaseReason classifyPurchase(UUID facilityId, UUID productId, int quantity, int alreadyDispensed) {
        if (productId == null) {
            return PurchaseReason.NOT_STOCKED;
        }
        PharmacyProduct product = productRepository.findById(productId)
                .orElseThrow(() -> new PharmacyValidationException("That medicine could not be found."));
        long onShelf = lotReader.shelf(facilityId, productId).usableTotal();
        // Units this same prescription already takes from the shelf are not left for the patient to buy.
        long available = Math.max(0, onShelf - alreadyDispensed);
        if (available >= quantity) {
            throw new PharmacyValidationException(product.getDisplayName() + " is in stock (" + available
                    + " available). Prescribe it from the pharmacy instead of asking the patient to buy it.");
        }
        return onShelf == 0 ? PurchaseReason.OUT_OF_STOCK : PurchaseReason.SHORT_STOCK;
    }

    static String shortStockMessage(String name, int asked, long available) {
        return available == 0
                ? name + " is out of stock. Add it to what the patient should buy, or choose another medicine."
                : "Only " + available + " of " + name + " " + (available == 1 ? "is" : "are") + " in stock (you asked for "
                + asked + "). Lower the quantity, or prescribe the rest for the patient to buy.";
    }

    private Map<UUID, PharmacyFacilityProduct> assortmentOf(UUID facilityId) {
        return assortmentRepository.findByFacilityIdAndActiveTrue(facilityId).stream()
                .collect(Collectors.toMap(PharmacyFacilityProduct::getProductId, Function.identity()));
    }

    private List<PharmacyProduct> sameGenericElsewhere(PharmacyProduct product,
                                                       Map<UUID, PharmacyFacilityProduct> assortment) {
        String generic = product.getGenericName();
        if (generic == null || generic.isBlank()) {
            return List.of();
        }
        return productService.search(generic.trim(), true, 0, MAX_RESULTS).getContent().stream()
                .filter(other -> !other.getId().equals(product.getId()) && assortment.containsKey(other.getId())
                        && generic.trim().equalsIgnoreCase(other.getGenericName() == null ? "" : other.getGenericName().trim()))
                .toList();
    }

    private List<Alternative> alternativesFor(List<PharmacyProduct> candidates, UUID facilityId, StockSnapshot shelf) {
        if (candidates == null) {
            return List.of();
        }
        List<Alternative> alternatives = new ArrayList<>();
        for (PharmacyProduct candidate : candidates) {
            long available = shelf.shelf(facilityId, candidate.getId()).usableTotal();
            if (available > 0) {
                alternatives.add(new Alternative(candidate.getId(), candidate.getDisplayName(), available));
            }
        }
        alternatives.sort(Comparator.comparingLong(Alternative::available).reversed());
        return alternatives.stream().limit(MAX_ALTERNATIVES).toList();
    }

    private Medicine toMedicine(PharmacyProduct product, UUID facilityId, StockSnapshot shelf,
                                PharmacyFacilityProduct assortment, List<Alternative> alternatives) {
        StockPicture picture = shelf.shelf(facilityId, product.getId());
        long available = picture.usableTotal();
        Integer reorderAt = assortment.getReorderThreshold();
        StockLevel level = available == 0 ? StockLevel.OUT
                : reorderAt != null && available <= reorderAt ? StockLevel.LOW : StockLevel.IN_STOCK;
        LocalDate nearestExpiry = picture.usableLots().stream().map(LotAvailability::expiryDate)
                .filter(date -> date != null).min(Comparator.naturalOrder()).orElse(null);
        return new Medicine(product.getId(), product.getCode(), product.getDisplayName(), product.getGenericName(),
                product.getStrength(), product.getDosageForm(), product.getBaseUnit(), product.getPackSize(),
                product.getSchedule(), available, level, nearestExpiry, alternatives);
    }
}
