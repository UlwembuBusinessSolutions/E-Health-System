package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.PrescriptionRepository;
import co.ehealth.platform.pharmacy.PrescriptionStatus;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// The pharmacy "find a prescription" box: by RX serial, patient name or MPI
// number, regardless of status — so one that fell off the queue can still be
// found and finished once stock is back. Returns lightweight summary rows;
// the full prescription is fetched when a row is opened.
@Service
public class PrescriptionSearchService {

    static final int MAX_RESULTS = 50;

    private final PermissionService permissionService;
    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionItemRepository itemRepository;
    private final PartyDirectory partyDirectory;

    public PrescriptionSearchService(PermissionService permissionService,
                                      PrescriptionRepository prescriptionRepository,
                                      PrescriptionItemRepository itemRepository, PartyDirectory partyDirectory) {
        this.permissionService = permissionService;
        this.prescriptionRepository = prescriptionRepository;
        this.itemRepository = itemRepository;
        this.partyDirectory = partyDirectory;
    }

    public record SearchRow(UUID id, String serialNumber, UUID patientId, String patientName, String patientMpi,
                            UUID facilityId, PrescriptionStatus status, SearchState queueState, int itemCount,
                            int dispensedItemCount, Instant createdAt) {
    }

    // facilityId null searches every facility; blank q lists the most recent.
    public List<SearchRow> search(String query, SearchState state, UUID facilityId) {
        permissionService.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        String pattern = likePattern(query);
        Pageable newest = PageRequest.of(0, MAX_RESULTS);
        List<Prescription> found = facilityId == null
                ? prescriptionRepository.search(pattern, state.statuses(), newest)
                : prescriptionRepository.searchAtFacility(pattern, facilityId, state.statuses(), newest);
        return toRows(found);
    }

    // Lower-cased and wrapped for a contains-match, with LIKE wildcards in
    // the typed text escaped so "50%" searches for "50%", not "50 anything".
    static String likePattern(String query) {
        String text = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }

    private List<SearchRow> toRows(List<Prescription> prescriptions) {
        if (prescriptions.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<PrescriptionItem>> itemsByPrescription = itemRepository
                .findByPrescriptionIdIn(prescriptions.stream().map(Prescription::getId).toList()).stream()
                .collect(Collectors.groupingBy(PrescriptionItem::getPrescriptionId));
        Map<UUID, Patient> patients = partyDirectory
                .patients(prescriptions.stream().map(Prescription::getPatientId).collect(Collectors.toSet()));
        return prescriptions.stream().map(prescription -> toRow(prescription,
                itemsByPrescription.getOrDefault(prescription.getId(), List.of()),
                patients.get(prescription.getPatientId()))).toList();
    }

    private SearchRow toRow(Prescription prescription, List<PrescriptionItem> items, Patient patient) {
        int dispensed = (int) items.stream().filter(item -> item.getStatus() == PrescriptionStatus.DISPENSED).count();
        return new SearchRow(prescription.getId(), prescription.getSerialNumber(), prescription.getPatientId(),
                PartyDirectory.fullName(patient), patient.getMpiNumber(), prescription.getFacilityId(),
                prescription.getStatus(), SearchState.of(prescription.getStatus()), items.size(), dispensed,
                prescription.getCreatedAt());
    }
}
