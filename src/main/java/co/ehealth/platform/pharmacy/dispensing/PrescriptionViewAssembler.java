package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.identity.User;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.pharmacy.DispensingRecord;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.PrescriptionOutOfStockRecord;
import co.ehealth.platform.pharmacy.PrescriptionStatus;
import co.ehealth.platform.pharmacy.dispensing.PrescriptionItemResponse.LotView;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

// Builds the prescription views the pharmacy screens read — queue, search
// result detail, patient medication tab — for a whole list at once, so the
// number of database queries does not grow with the number of prescriptions.
@Component
public class PrescriptionViewAssembler {

    private final PrescriptionItemRepository itemRepository;
    private final ItemFactsLoader factsLoader;
    private final PartyDirectory partyDirectory;

    public PrescriptionViewAssembler(PrescriptionItemRepository itemRepository, ItemFactsLoader factsLoader,
                                      PartyDirectory partyDirectory) {
        this.itemRepository = itemRepository;
        this.factsLoader = factsLoader;
        this.partyDirectory = partyDirectory;
    }

    public PrescriptionResponse assemble(Prescription prescription) {
        return assemble(List.of(prescription)).get(0);
    }

    public List<PrescriptionResponse> assemble(List<Prescription> prescriptions) {
        if (prescriptions.isEmpty()) {
            return List.of();
        }
        List<UUID> prescriptionIds = prescriptions.stream().map(Prescription::getId).toList();
        Map<UUID, List<PrescriptionItem>> itemsByPrescription = itemRepository
                .findByPrescriptionIdIn(prescriptionIds).stream()
                .collect(Collectors.groupingBy(PrescriptionItem::getPrescriptionId));
        List<PrescriptionItem> allItems = itemsByPrescription.values().stream().flatMap(List::stream).toList();

        ItemFacts facts = factsLoader.load(prescriptions, allItems);
        Map<UUID, Patient> patients = partyDirectory
                .patients(prescriptions.stream().map(Prescription::getPatientId).collect(Collectors.toSet()));
        Map<UUID, User> users = partyDirectory.users(staffIdsOn(prescriptions, facts));

        return prescriptions.stream().map(prescription -> toResponse(prescription,
                itemsByPrescription.getOrDefault(prescription.getId(), List.of()), facts,
                patients.get(prescription.getPatientId()), users)).toList();
    }

    private Set<UUID> staffIdsOn(List<Prescription> prescriptions, ItemFacts facts) {
        Set<UUID> staffIds = new HashSet<>();
        prescriptions.forEach(prescription -> staffIds.add(prescription.getPrescriberId()));
        facts.dispensingRecords().values().forEach(record -> staffIds.add(record.getDispensedByUserId()));
        facts.outOfStockRecords().values().forEach(record -> staffIds.add(record.getMarkedByUserId()));
        return staffIds;
    }

    private PrescriptionResponse toResponse(Prescription prescription, List<PrescriptionItem> items,
                                            ItemFacts facts, Patient patient, Map<UUID, User> users) {
        User prescriber = users.get(prescription.getPrescriberId());
        List<PrescriptionItemResponse> itemResponses = items.stream()
                .map(item -> toItemResponse(prescription, item, facts, users)).toList();
        return new PrescriptionResponse(prescription.getId(), prescription.getSerialNumber(),
                prescription.getVisitId(), prescription.getPatientId(), PartyDirectory.fullName(patient),
                patient.getMpiNumber(), prescription.getFacilityId(), prescription.getPrescriberId(),
                prescriber == null ? null : PartyDirectory.fullName(prescriber),
                prescriber == null ? null : PartyDirectory.registrationNumber(prescriber),
                prescriber == null ? null : prescriber.getContactNumber(),
                prescriber == null ? null : prescriber.getEmail(), prescription.getConsultationId(),
                prescription.getStatus(), itemResponses, prescription.getCreatedAt());
    }

    private PrescriptionItemResponse toItemResponse(Prescription prescription, PrescriptionItem item,
                                                    ItemFacts facts, Map<UUID, User> users) {
        DispensingRecord dispensing = facts.dispensingRecords().get(item.getId());
        PrescriptionOutOfStockRecord outOfStock = facts.outOfStockRecords().get(item.getId());
        PrescriptionSubstitution substitution = facts.latestSubstitutions().get(item.getId());
        UUID productId = item.getProductId() != null ? item.getProductId()
                : facts.suggestedProductIds().get(item.getId());
        UUID dispensingProductId = facts.dispensingProductId(item);
        StockFigures stock = stockFigures(prescription, item, facts);
        MedicineSchedule schedule = dispensingProductId == null ? null : facts.schedules().get(dispensingProductId);

        return new PrescriptionItemResponse(item.getId(), item.getDrugName(), item.getDosage(), item.getQuantity(),
                item.getStatus(), dispensing == null ? null : nameOf(users, dispensing.getDispensedByUserId()),
                dispensing == null ? null : dispensing.getDispensedAt(),
                outOfStock == null ? null : nameOf(users, outOfStock.getMarkedByUserId()),
                outOfStock == null ? null : outOfStock.getMarkedAt(),
                outOfStock == null ? null : outOfStock.getNote(), productId, facts.mappingStatus(item),
                facts.productName(productId), dispensingProductId, facts.productName(dispensingProductId),
                item.getDispensedQuantity(), item.getRemainingQuantity(),
                facts.returnedByItem().getOrDefault(item.getId(), 0), stock.available(), stock.status(),
                stock.suggestedLot(), stock.usableLots(), stock.expiredLots(), schedule != null, schedule,
                substitution == null ? null : substitution.getStatus(),
                substitution == null ? null : substitution.getSubstituteProductId(),
                substitution == null ? null : facts.productName(substitution.getSubstituteProductId()));
    }

    private String nameOf(Map<UUID, User> users, UUID userId) {
        User user = users.get(userId);
        return user == null ? null : PartyDirectory.fullName(user);
    }

    private record StockFigures(long available, StockStatus status, LotView suggestedLot, List<LotView> usableLots,
                                List<LotView> expiredLots) {
        static final StockFigures NOT_APPLICABLE = new StockFigures(0, null, null, List.of(), List.of());
    }

    // Stock only matters for a line that still has something to hand over and
    // a known product to hand it over from. IN_STOCK means the remaining
    // quantity is covered by lots in date; LOW means some, but not enough;
    // NONE means nothing usable ("8 of 20" is LOW, never NONE).
    private StockFigures stockFigures(Prescription prescription, PrescriptionItem item, ItemFacts facts) {
        boolean nothingToDispense = item.getStatus() == PrescriptionStatus.DISPENSED
                || item.getRemainingQuantity() == 0;
        if (nothingToDispense || facts.dispensingProductId(item) == null) {
            return StockFigures.NOT_APPLICABLE;
        }
        StockPicture shelf = facts.shelf(prescription, item);
        long usable = shelf.usableTotal();
        StockStatus status = usable == 0 ? StockStatus.NONE
                : usable < item.getRemainingQuantity() ? StockStatus.LOW : StockStatus.IN_STOCK;
        return new StockFigures(usable, status,
                shelf.suggestedLot(item.getRemainingQuantity()).map(LotView::of).orElse(null),
                shelf.usableLots().stream().map(LotView::of).toList(),
                shelf.expiredLots().stream().map(LotView::of).toList());
    }
}
