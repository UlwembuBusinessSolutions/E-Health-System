package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.common.InvalidFileTypeException;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.pharmacy.Prescription;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.prescription;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CollectionDetailsServiceTest {

    private static final String ID_NUMBER = "8001015009087";
    private static final String PROOF_REF = "6f1d1f0e-3c1b-4e5a-9a39-0c8b5d7f2a11";

    private final DispensingGuard guard = mock(DispensingGuard.class);
    private final PrescriptionCollectionRepository collectionRepository =
            mock(PrescriptionCollectionRepository.class);
    private final PartyDirectory partyDirectory = mock(PartyDirectory.class);
    private final CollectionProofStorage proofStorage = mock(CollectionProofStorage.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final CollectionDetailsService service = new CollectionDetailsService(guard, collectionRepository,
            partyDirectory, proofStorage, auditLogService);

    private final Prescription prescription = prescription();
    private final UUID viewerId = UUID.randomUUID();
    private final UUID pharmacistId = UUID.randomUUID();

    private PrescriptionCollection thirdPartyCollection() {
        var collector = new CollectCommand.Collector("Sipho Dlamini", "SA_ID", ID_NUMBER, "Brother", "0821234567",
                AuthorisationType.WRITTEN);
        var command = new CollectCommand(null, false, collector, true, "data:image/png;base64,AAAA", PROOF_REF,
                "ID checked", WitnessCredentials.NONE);
        PrescriptionCollection collection = new PrescriptionCollection(prescription.getId(), command, pharmacistId,
                Instant.parse("2026-10-04T09:00:00Z"));
        ReflectionTestUtils.setField(collection, "id", UUID.randomUUID());
        return collection;
    }

    private void prescriptionWasCollected(PrescriptionCollection collection) {
        when(guard.loadPrescription(prescription.getId())).thenReturn(prescription);
        when(collectionRepository.findFirstByPrescriptionIdOrderByHandedOverAtDesc(prescription.getId()))
                .thenReturn(Optional.of(collection));
        User pharmacist = mock(User.class);
        when(pharmacist.getFirstName()).thenReturn("Thandi");
        when(pharmacist.getLastName()).thenReturn("Nkosi");
        when(partyDirectory.users(List.of(pharmacistId))).thenReturn(Map.of(pharmacistId, pharmacist));
    }

    @Test
    void detailsCarryTheFullThirdPartyIdNumberProofLinkAndSignature() {
        prescriptionWasCollected(thirdPartyCollection());

        CollectionDetailsResponse details = service.view(prescription.getId(), viewerId);

        assertEquals(ID_NUMBER, details.collectorIdNumber());
        assertEquals("Sipho Dlamini", details.collectorName());
        assertEquals("/api/v1/prescriptions/" + prescription.getId() + "/collection-proof/" + PROOF_REF,
                details.proofUrl());
        assertEquals("data:image/png;base64,AAAA", details.signatureDataUrl());
        assertEquals("Thandi Nkosi", details.handedOverByName());
        assertFalse(details.collectedByPatient());
        assertTrue(details.idVerified());
    }

    @Test
    void openingTheDetailsIsAuditLoggedWithoutRepeatingTheIdNumberOrSignature() {
        PrescriptionCollection collection = thirdPartyCollection();
        prescriptionWasCollected(collection);

        service.view(prescription.getId(), viewerId);

        ArgumentCaptor<String> afterValue = ArgumentCaptor.forClass(String.class);
        verify(auditLogService).append(eq(viewerId), eq(prescription.getFacilityId()),
                eq("COLLECTION_DETAILS_VIEWED"), eq("PrescriptionCollection"), eq(collection.getId().toString()),
                isNull(), afterValue.capture());
        assertFalse(afterValue.getValue().contains(ID_NUMBER));
        assertFalse(afterValue.getValue().contains("data:image"));
    }

    @Test
    void collectionByThePatientHasNoCollectorOrProofLink() {
        PrescriptionCollection byPatient = new PrescriptionCollection(prescription.getId(),
                CollectCommand.patientTakesAllPending(), pharmacistId, Instant.parse("2026-10-04T09:00:00Z"));
        ReflectionTestUtils.setField(byPatient, "id", UUID.randomUUID());
        prescriptionWasCollected(byPatient);

        CollectionDetailsResponse details = service.view(prescription.getId(), viewerId);

        assertTrue(details.collectedByPatient());
        assertNull(details.collectorIdNumber());
        assertNull(details.proofUrl());
        assertNull(details.signatureDataUrl());
    }

    @Test
    void prescriptionNeverCollectedHasNoDetailsAndNothingIsLogged() {
        when(guard.loadPrescription(prescription.getId())).thenReturn(prescription);
        when(collectionRepository.findFirstByPrescriptionIdOrderByHandedOverAtDesc(prescription.getId()))
                .thenReturn(Optional.empty());

        assertThrows(CollectionNotFoundException.class, () -> service.view(prescription.getId(), viewerId));

        verify(auditLogService, never()).append(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void proofUploadAcceptsPdfJpegAndPngUpToFiveMegabytes() {
        CollectionProofStorage.requireAcceptable("application/pdf", 5L * 1024 * 1024);
        CollectionProofStorage.requireAcceptable("image/jpeg", 1);
        CollectionProofStorage.requireAcceptable("image/png", 2048);
    }

    @Test
    void proofUploadRefusesOtherTypesEmptyAndOversizedFiles() {
        assertThrows(InvalidFileTypeException.class,
                () -> CollectionProofStorage.requireAcceptable("image/webp", 100));
        assertThrows(InvalidFileTypeException.class, () -> CollectionProofStorage.requireAcceptable(null, 100));
        assertThrows(DispensingValidationException.class,
                () -> CollectionProofStorage.requireAcceptable("application/pdf", 0));
        assertThrows(DispensingValidationException.class,
                () -> CollectionProofStorage.requireAcceptable("application/pdf", 5L * 1024 * 1024 + 1));
    }
}
