package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.PrescriptionOutOfStockRecord;
import co.ehealth.platform.pharmacy.PrescriptionRepository;
import co.ehealth.platform.pharmacy.PrescriptionStatus;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// "Stock has arrived" worklist: items the pharmacy marked out of stock whose
// product now has usable stock. It only POINTS at them — nothing is
// dispensed automatically and the earlier out-of-stock record is untouched
// (plan section 9, rule 8).
@Service
public class StockArrivalService {

    private final PermissionService permissionService;
    private final PrescriptionItemRepository itemRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final ItemFactsLoader factsLoader;
    private final PartyDirectory partyDirectory;

    public StockArrivalService(PermissionService permissionService, PrescriptionItemRepository itemRepository,
                                PrescriptionRepository prescriptionRepository, ItemFactsLoader factsLoader,
                                PartyDirectory partyDirectory) {
        this.permissionService = permissionService;
        this.itemRepository = itemRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.factsLoader = factsLoader;
        this.partyDirectory = partyDirectory;
    }

    // canFulfilInFull is false when only part of the remaining quantity is
    // now available ("8 of 20" has arrived), so the UI can say so.
    public record StockArrival(UUID prescriptionId, String prescriptionSerial, UUID patientId, String patientName,
                               String patientMpi, UUID itemId, String drugName, UUID productId, String productName,
                               int remainingQuantity, long availableQuantity, boolean canFulfilInFull,
                               Instant markedOutOfStockAt) {
    }

    public List<StockArrival> listArrivals(UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        List<PrescriptionItem> outOfStockItems = itemRepository.findByFacilityAndStatus(facilityId,
                PrescriptionStatus.OUT_OF_STOCK);
        if (outOfStockItems.isEmpty()) {
            return List.of();
        }
        Map<UUID, Prescription> prescriptions = prescriptionRepository
                .findAllById(outOfStockItems.stream().map(PrescriptionItem::getPrescriptionId).distinct().toList())
                .stream().collect(Collectors.toMap(Prescription::getId, Function.identity()));
        ItemFacts facts = factsLoader.load(prescriptions.values(), outOfStockItems);
        Map<UUID, Patient> patients = partyDirectory.patients(
                prescriptions.values().stream().map(Prescription::getPatientId).collect(Collectors.toSet()));

        return outOfStockItems.stream()
                .filter(item -> facts.shelf(prescriptions.get(item.getPrescriptionId()), item).usableTotal() > 0)
                .map(item -> toArrival(prescriptions.get(item.getPrescriptionId()), item, facts, patients))
                .toList();
    }

    private StockArrival toArrival(Prescription prescription, PrescriptionItem item, ItemFacts facts,
                                   Map<UUID, Patient> patients) {
        Patient patient = patients.get(prescription.getPatientId());
        UUID productId = facts.dispensingProductId(item);
        long available = facts.shelf(prescription, item).usableTotal();
        PrescriptionOutOfStockRecord outOfStock = facts.outOfStockRecords().get(item.getId());
        return new StockArrival(prescription.getId(), prescription.getSerialNumber(), patient.getId(),
                PartyDirectory.fullName(patient), patient.getMpiNumber(), item.getId(), item.getDrugName(), productId,
                facts.productName(productId), item.getRemainingQuantity(), available,
                available >= item.getRemainingQuantity(),
                outOfStock == null ? null : outOfStock.getMarkedAt());
    }
}
