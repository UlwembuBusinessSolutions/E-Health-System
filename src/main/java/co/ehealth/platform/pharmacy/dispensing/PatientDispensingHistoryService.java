package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.PrescriptionRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyBatch;
import co.ehealth.platform.pharmacy.stock.PharmacyBatchRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

// "What has this patient actually been handed, from which lot?" — one row per
// lot per dispense, newest first. This is the trail a recall follows from a
// lot number back to the people who received it.
@Service
public class PatientDispensingHistoryService {

    static final int MAX_ROWS = 200;

    private final PermissionService permissionService;
    private final DispenseAllocationRepository allocationRepository;
    private final PrescriptionItemRepository itemRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PharmacyBatchRepository batchRepository;
    private final PharmacyProductRepository productRepository;
    private final PartyDirectory partyDirectory;

    public PatientDispensingHistoryService(PermissionService permissionService,
                                            DispenseAllocationRepository allocationRepository,
                                            PrescriptionItemRepository itemRepository,
                                            PrescriptionRepository prescriptionRepository,
                                            PharmacyBatchRepository batchRepository,
                                            PharmacyProductRepository productRepository,
                                            PartyDirectory partyDirectory) {
        this.permissionService = permissionService;
        this.allocationRepository = allocationRepository;
        this.itemRepository = itemRepository;
        this.prescriptionRepository = prescriptionRepository;
        this.batchRepository = batchRepository;
        this.productRepository = productRepository;
        this.partyDirectory = partyDirectory;
    }

    public record DispensingHistoryRow(UUID allocationId, UUID prescriptionId, String prescriptionSerial,
                                       UUID itemId, String drugName, UUID productId, String productName,
                                       UUID batchId, String lotNumber, LocalDate expiryDate, int quantity,
                                       Instant dispensedAt, String dispensedByName) {
    }

    public List<DispensingHistoryRow> historyFor(UUID patientId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        List<DispenseAllocation> allocations = allocationRepository.findForPatient(patientId,
                PageRequest.of(0, MAX_ROWS));
        if (allocations.isEmpty()) {
            return List.of();
        }
        Map<UUID, PrescriptionItem> items = indexById(itemRepository.findAllById(
                allocations.stream().map(DispenseAllocation::getPrescriptionItemId).distinct().toList()),
                PrescriptionItem::getId);
        Map<UUID, Prescription> prescriptions = indexById(prescriptionRepository.findAllById(
                items.values().stream().map(PrescriptionItem::getPrescriptionId).distinct().toList()),
                Prescription::getId);
        Map<UUID, PharmacyBatch> batches = indexById(batchRepository.findAllById(
                allocations.stream().map(DispenseAllocation::getBatchId).distinct().toList()), PharmacyBatch::getId);
        Map<UUID, PharmacyProduct> products = indexById(productRepository.findAllById(
                batches.values().stream().map(PharmacyBatch::getProductId).distinct().toList()),
                PharmacyProduct::getId);
        Map<UUID, User> staff = partyDirectory.users(
                allocations.stream().map(DispenseAllocation::getDispensedBy).collect(Collectors.toSet()));

        return allocations.stream().map(allocation -> {
            PrescriptionItem item = items.get(allocation.getPrescriptionItemId());
            PharmacyBatch batch = batches.get(allocation.getBatchId());
            PharmacyProduct product = products.get(batch.getProductId());
            User dispenser = staff.get(allocation.getDispensedBy());
            return new DispensingHistoryRow(allocation.getId(), item.getPrescriptionId(),
                    prescriptions.get(item.getPrescriptionId()).getSerialNumber(), item.getId(), item.getDrugName(),
                    product.getId(), product.getDisplayName(), batch.getId(), batch.getLotNumber(),
                    batch.getExpiryDate(), allocation.getQuantity(), allocation.getCreatedAt(),
                    dispenser == null ? null : PartyDirectory.fullName(dispenser));
        }).toList();
    }

    private static <T> Map<UUID, T> indexById(List<T> rows, Function<T, UUID> id) {
        return rows.stream().collect(Collectors.toMap(id, Function.identity()));
    }
}
