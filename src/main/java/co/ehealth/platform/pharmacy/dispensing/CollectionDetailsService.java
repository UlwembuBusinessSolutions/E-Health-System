package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.dispensing.CollectionProofStorage.StoredProof;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

// Who collected a prescription and the proof they gave. The details hold a
// third party's full ID number, so every time they are opened that is
// written to the audit log; the entry names the viewer and the collection
// but never repeats the ID number itself.
@Service
public class CollectionDetailsService {

    private final DispensingGuard guard;
    private final PrescriptionCollectionRepository collectionRepository;
    private final PartyDirectory partyDirectory;
    private final CollectionProofStorage proofStorage;
    private final AuditLogService auditLogService;

    public CollectionDetailsService(DispensingGuard guard, PrescriptionCollectionRepository collectionRepository,
                                    PartyDirectory partyDirectory, CollectionProofStorage proofStorage,
                                    AuditLogService auditLogService) {
        this.guard = guard;
        this.collectionRepository = collectionRepository;
        this.partyDirectory = partyDirectory;
        this.proofStorage = proofStorage;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public CollectionDetailsResponse view(UUID prescriptionId, UUID viewerUserId) {
        Prescription prescription = guard.loadPrescription(prescriptionId);
        PrescriptionCollection collection = collectionRepository
                .findFirstByPrescriptionIdOrderByHandedOverAtDesc(prescriptionId)
                .orElseThrow(CollectionNotFoundException::new);
        auditLogService.append(viewerUserId, prescription.getFacilityId(), "COLLECTION_DETAILS_VIEWED",
                "PrescriptionCollection", collection.getId().toString(), null,
                "prescriptionId=" + prescriptionId);
        return responseFor(collection);
    }

    public String storeProof(UUID prescriptionId, MultipartFile file, UUID staffId) {
        guard.requireManager(staffId);
        guard.loadPrescription(prescriptionId);
        return proofStorage.store(prescriptionId, file);
    }

    public StoredProof proof(UUID prescriptionId, String proofRef) {
        guard.loadPrescription(prescriptionId);
        return proofStorage.load(prescriptionId, proofRef);
    }

    private CollectionDetailsResponse responseFor(PrescriptionCollection collection) {
        return new CollectionDetailsResponse(collection.isCollectedByPatient(), collection.getCollectorName(),
                collection.getCollectorIdType(), collection.getCollectorIdNumber(), collection.getRelationship(),
                collection.getPhone(), collection.getAuthorisationType(), proofUrlOf(collection),
                collection.getSignatureDataUrl(), collection.isIdVerified(), collection.getNotes(),
                handedOverByName(collection), collection.getHandedOverAt());
    }

    static String proofUrlOf(PrescriptionCollection collection) {
        String proofRef = collection.getProofDocumentRef();
        return proofRef == null ? null
                : "/api/v1/prescriptions/" + collection.getPrescriptionId() + "/collection-proof/" + proofRef;
    }

    private String handedOverByName(PrescriptionCollection collection) {
        User handedOverBy = partyDirectory.users(List.of(collection.getHandedOverBy()))
                .get(collection.getHandedOverBy());
        return handedOverBy == null ? null : PartyDirectory.fullName(handedOverBy);
    }
}
