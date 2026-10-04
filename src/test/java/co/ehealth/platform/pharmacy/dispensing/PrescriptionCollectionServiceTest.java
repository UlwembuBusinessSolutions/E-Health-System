package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.item;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.prescription;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseOutcome;
import co.ehealth.platform.pharmacy.dispensing.PrescriptionCollectionService.CollectOutcome;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PrescriptionCollectionServiceTest {

    private final DispensingActor actor = new DispensingActor(UUID.randomUUID(), "Pat Pharmacist");
    private final UUID productId = UUID.randomUUID();

    private DispensingGuard guard;
    private PrescriptionItemRepository itemRepository;
    private DispenseAllocationService allocationService;
    private SubstitutionLookup substitutionLookup;
    private ProductScheduleLookup scheduleLookup;
    private PrescriptionCollectionRepository collectionRepository;
    private PrescriptionRollup rollup;
    private PrescriptionCollectionService service;
    private Prescription prescription;
    private PrescriptionItem inStock;
    private PrescriptionItem noStock;

    @BeforeEach
    void setUp() {
        guard = mock(DispensingGuard.class);
        itemRepository = mock(PrescriptionItemRepository.class);
        allocationService = mock(DispenseAllocationService.class);
        substitutionLookup = mock(SubstitutionLookup.class);
        scheduleLookup = mock(ProductScheduleLookup.class);
        collectionRepository = mock(PrescriptionCollectionRepository.class);
        rollup = mock(PrescriptionRollup.class);
        service = new PrescriptionCollectionService(guard, itemRepository, allocationService, new CollectionRules(),
                substitutionLookup, scheduleLookup, collectionRepository, rollup, mock(AuditLogService.class),
                Clock.fixed(Instant.parse("2026-10-04T10:00:00Z"), ZoneOffset.UTC));

        prescription = prescription();
        inStock = item(prescription, 10, productId);
        noStock = item(prescription, 5, productId);
        when(guard.requireDispenser(actor.userId())).thenReturn(actor);
        when(guard.loadPrescription(prescription.getId())).thenReturn(prescription);
        when(itemRepository.findByPrescriptionId(prescription.getId())).thenReturn(List.of(inStock, noStock));
        when(substitutionLookup.dispensingProductId(any())).thenReturn(productId);
        when(scheduleLookup.schedulesFor(any())).thenReturn(Map.of());
        when(allocationService.findBlocker(prescription, inStock)).thenReturn(Optional.empty());
        when(allocationService.findBlocker(prescription, noStock))
                .thenReturn(Optional.of(SkipReason.NO_USABLE_STOCK));
        PrescriptionCollection saved = mock(PrescriptionCollection.class);
        when(saved.getId()).thenReturn(UUID.randomUUID());
        when(collectionRepository.save(any())).thenReturn(saved);
    }

    private void stubDispense(PrescriptionItem item) {
        LotAvailability lot = new LotAvailability(prescription.getFacilityId(), productId, UUID.randomUUID(),
                UUID.randomUUID(), "LOT-1", null, 100);
        when(allocationService.dispense(eq(prescription), eq(item.getId()), any(), eq(actor)))
                .thenReturn(new DispenseOutcome(item, List.of(new LotDraw(lot, item.getQuantity()))));
    }

    @Test
    void handsOverInStockItemsAndReportsTheRestAsSkippedNotFailed() {
        stubDispense(inStock);

        CollectOutcome outcome = service.collect(prescription.getId(), CollectCommand.patientTakesAllPending(),
                actor.userId());

        assertEquals(1, outcome.handedOver().size());
        assertEquals(inStock.getId(), outcome.handedOver().get(0).itemId());
        assertEquals(10, outcome.handedOver().get(0).quantity());
        assertEquals(1, outcome.skipped().size());
        assertEquals(noStock.getId(), outcome.skipped().get(0).itemId());
        assertEquals(SkipReason.NO_USABLE_STOCK, outcome.skipped().get(0).reason());
        verify(allocationService, never()).dispense(eq(prescription), eq(noStock.getId()), any(), any());
    }

    @Test
    void recordsOneCollectionAndRefreshesTheStatusWhenSomethingWasHandedOver() {
        stubDispense(inStock);

        CollectOutcome outcome = service.collect(prescription.getId(), CollectCommand.patientTakesAllPending(),
                actor.userId());

        verify(collectionRepository).save(any(PrescriptionCollection.class));
        verify(rollup).refresh(prescription);
        org.junit.jupiter.api.Assertions.assertNotNull(outcome.collectionId());
    }

    @Test
    void recordsNoCollectionWhenNothingIsInStock() {
        when(allocationService.findBlocker(prescription, inStock)).thenReturn(Optional.of(SkipReason.NOT_MAPPED));

        CollectOutcome outcome = service.collect(prescription.getId(), CollectCommand.patientTakesAllPending(),
                actor.userId());

        assertNull(outcome.collectionId());
        assertEquals(0, outcome.handedOver().size());
        assertEquals(2, outcome.skipped().size());
        verify(collectionRepository, never()).save(any());
    }

    @Test
    void namedItemsRestrictTheHandOver() {
        stubDispense(inStock);
        CollectCommand command = new CollectCommand(List.of(inStock.getId()), true, null, false, null, null, null,
                WitnessCredentials.NONE);

        CollectOutcome outcome = service.collect(prescription.getId(), command, actor.userId());

        assertEquals(1, outcome.handedOver().size());
        assertEquals(0, outcome.skipped().size());
    }

    @Test
    void refusesVerbalConsentForScheduledMedicineBeforeAnyStockMoves() {
        when(scheduleLookup.schedulesFor(any())).thenReturn(Map.of(productId, DrugSchedule.S5));
        var collector = new CollectCommand.Collector("Sipho", "SA_ID", "8001015009087", "Brother", null,
                AuthorisationType.VERBAL);
        CollectCommand command = new CollectCommand(null, false, collector, true, null, UUID.randomUUID().toString(), null,
                WitnessCredentials.NONE);

        assertThrows(DispensingValidationException.class,
                () -> service.collect(prescription.getId(), command, actor.userId()));
        verify(allocationService, never()).dispense(any(), any(), any(), any());
    }
}
