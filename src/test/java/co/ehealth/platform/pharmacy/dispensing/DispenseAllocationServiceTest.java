package co.ehealth.platform.pharmacy.dispensing;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.pharmacy.register.InvalidWitnessException;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.FACILITY_ID;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.PRODUCT_ID;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.item;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.lot;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.prescription;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.shelf;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.pharmacy.DispensingRecord;
import co.ehealth.platform.pharmacy.DispensingRecordRepository;
import co.ehealth.platform.pharmacy.Prescription;
import co.ehealth.platform.pharmacy.PrescriptionAlreadyDispensedException;
import co.ehealth.platform.pharmacy.PrescriptionItem;
import co.ehealth.platform.pharmacy.PrescriptionItemRepository;
import co.ehealth.platform.pharmacy.PrescriptionStatus;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseOutcome;
import co.ehealth.platform.pharmacy.dispensing.DispenseAllocationService.DispenseRequest;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService.EntryRequest;
import co.ehealth.platform.pharmacy.stock.PharmacyStockTransaction;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DispenseAllocationServiceTest {

    @Mock private PrescriptionItemRepository itemRepository;
    @Mock private ItemLock itemLock;
    @Mock private DispensingRecordRepository dispensingRecordRepository;
    @Mock private DispenseAllocationRepository allocationRepository;
    @Mock private StockLotReader lotReader;
    @Mock private SubstitutionLookup substitutionLookup;
    @Mock private PatientLedgerPoster ledgerPoster;
    @Mock private ProductScheduleLookup scheduleLookup;
    @Mock private ScheduleRegisterRecorder registerRecorder;
    @Mock private WitnessConfirmation witnessConfirmation;
    @Mock private PartyDirectory partyDirectory;
    @Mock private AuditLogService auditLogService;

    private final DispensingActor actor = new DispensingActor(UUID.randomUUID(), "Pat Pharmacist");
    private DispenseAllocationService service;
    private Prescription prescription;
    private PrescriptionItem item;
    private LotAvailability stockedLot;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-10-04T10:00:00Z"), ZoneOffset.UTC);
        service = new DispenseAllocationService(itemRepository, itemLock, dispensingRecordRepository,
                allocationRepository, lotReader, new FefoLotSelector(), substitutionLookup, ledgerPoster,
                scheduleLookup, registerRecorder, witnessConfirmation, partyDirectory, auditLogService, clock);

        prescription = prescription();
        item = item(prescription, 20, PRODUCT_ID);
        stockedLot = lot("LOT-A", "2027-05-31", 100);

        when(itemLock.lockOwnedItem(prescription, item.getId())).thenReturn(item);
        when(substitutionLookup.dispensingProductId(item)).thenReturn(PRODUCT_ID);
        when(lotReader.shelf(FACILITY_ID, PRODUCT_ID)).thenReturn(shelf(stockedLot));
        PharmacyStockTransaction transaction = mock(PharmacyStockTransaction.class);
        when(transaction.getId()).thenReturn(UUID.randomUUID());
        when(ledgerPoster.post(any(), any(), any(), anyString(), anyString(), anyList())).thenReturn(transaction);
        when(scheduleLookup.schedulesFor(any())).thenReturn(Map.of());
    }

    @Test
    void partialDispenseTakesOnlyTheRequestedQuantityAndLeavesTheRestPending() {
        DispenseOutcome outcome = service.dispense(prescription, item.getId(), new DispenseRequest(8, null, WitnessCredentials.NONE), actor);

        assertEquals(8, outcome.dispensedNow());
        assertEquals(8, item.getDispensedQuantity());
        assertEquals(12, item.getRemainingQuantity());
        assertEquals(PrescriptionStatus.PENDING, item.getStatus());
        verify(dispensingRecordRepository, never()).save(any());
    }

    @Test
    void dispensingWithoutAQuantityTakesEverythingRemainingAndCompletesTheItem() {
        service.dispense(prescription, item.getId(), new DispenseRequest(8, null, WitnessCredentials.NONE), actor);

        DispenseOutcome outcome = service.dispense(prescription, item.getId(), DispenseRequest.remaining(), actor);

        assertEquals(12, outcome.dispensedNow());
        assertEquals(0, item.getRemainingQuantity());
        assertEquals(PrescriptionStatus.DISPENSED, item.getStatus());
        verify(dispensingRecordRepository).save(any(DispensingRecord.class));
    }

    @Test
    void eachAttemptGetsItsOwnIdempotencyKeyDerivedFromTheAlreadyDispensedQuantity() {
        service.dispense(prescription, item.getId(), new DispenseRequest(8, null, WitnessCredentials.NONE), actor);
        service.dispense(prescription, item.getId(), DispenseRequest.remaining(), actor);

        ArgumentCaptor<String> keys = ArgumentCaptor.forClass(String.class);
        verify(ledgerPoster, org.mockito.Mockito.times(2)).post(eq(StockTransactionType.DISPENSE), eq(prescription),
                eq(actor), anyString(), keys.capture(), anyList());
        assertEquals(List.of("dispense:" + item.getId() + ":0", "dispense:" + item.getId() + ":8"),
                keys.getAllValues());
    }

    @Test
    void deductsTheDispensedQuantityFromTheChosenLotAsANegativeLedgerEntry() {
        service.dispense(prescription, item.getId(), new DispenseRequest(8, null, WitnessCredentials.NONE), actor);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<EntryRequest>> entries = ArgumentCaptor.forClass(List.class);
        verify(ledgerPoster).post(eq(StockTransactionType.DISPENSE), eq(prescription), eq(actor), anyString(),
                anyString(), entries.capture());
        assertEquals(1, entries.getValue().size());
        assertEquals(-8, entries.getValue().get(0).quantityDelta());
        assertEquals(stockedLot.batchId(), entries.getValue().get(0).batchId());
    }

    @Test
    void refusesAQuantityLargerThanWhatIsStillToDispense() {
        service.dispense(prescription, item.getId(), new DispenseRequest(8, null, WitnessCredentials.NONE), actor);

        assertThrows(DispensingValidationException.class,
                () -> service.dispense(prescription, item.getId(), new DispenseRequest(13, null, WitnessCredentials.NONE), actor));
        verify(ledgerPoster, org.mockito.Mockito.times(1)).post(any(), any(), any(), anyString(), anyString(),
                anyList());
    }

    @Test
    void refusesAZeroQuantity() {
        assertThrows(DispensingValidationException.class,
                () -> service.dispense(prescription, item.getId(), new DispenseRequest(0, null, WitnessCredentials.NONE), actor));
    }

    @Test
    void refusesAnItemNoProductHasBeenChosenFor() {
        when(substitutionLookup.dispensingProductId(item)).thenReturn(null);

        assertThrows(ProductNotMappedException.class,
                () -> service.dispense(prescription, item.getId(), DispenseRequest.remaining(), actor));
        verify(ledgerPoster, never()).post(any(), any(), any(), anyString(), anyString(), anyList());
    }

    @Test
    void refusesAnItemThatIsAlreadyFullyDispensed() {
        item.recordDispensed(20);

        assertThrows(PrescriptionAlreadyDispensedException.class,
                () -> service.dispense(prescription, item.getId(), DispenseRequest.remaining(), actor));
    }

    @Test
    void registersEveryLotOfAScheduledMedicineInTheSameTransaction() {
        scheduledProductWithKnownParties(DrugSchedule.S5);

        service.dispense(prescription, item.getId(), new DispenseRequest(5, null, WitnessCredentials.NONE), actor);

        verify(registerRecorder).recordDispense(eq(FACILITY_ID), eq(PRODUCT_ID), eq(prescription.getSerialNumber()),
                any(), eq(prescription.getPatientId().toString()), any(), any(), eq(5L), eq("LOT-A"),
                eq(actor.userId()), any(), isNull());
    }

    @Test
    void scheduleSixWithoutAWitnessIsRefusedBeforeAnyStockMoves() {
        scheduledProductWithKnownParties(DrugSchedule.S6);

        DispensingValidationException refusal = assertThrows(DispensingValidationException.class, () -> service
                .dispense(prescription, item.getId(), new DispenseRequest(5, null, WitnessCredentials.NONE), actor));

        assertEquals("A second pharmacist must witness Schedule 6 medicine.", refusal.getMessage());
        verify(ledgerPoster, never()).post(any(), any(), any(), anyString(), anyString(), anyList());
        verify(registerRecorder, never()).recordDispense(any(), any(), any(), any(), any(), any(), any(), anyLong(),
                any(), any(), any(), any());
    }

    @Test
    void scheduleSixWithAWitnessWhoseNameButNotPasswordWasGivenIsRefused() {
        scheduledProductWithKnownParties(DrugSchedule.S6);
        var passwordMissing = new WitnessCredentials(UUID.randomUUID(), " ");

        assertThrows(DispensingValidationException.class, () -> service
                .dispense(prescription, item.getId(), new DispenseRequest(5, null, passwordMissing), actor));

        verify(witnessConfirmation, never()).confirm(any(), any());
    }

    @Test
    void confirmedWitnessIsPassedToTheRegisterEntry() {
        scheduledProductWithKnownParties(DrugSchedule.S6);
        var witness = new WitnessCredentials(UUID.randomUUID(), "witness-password");
        when(witnessConfirmation.confirm(actor.userId(), witness)).thenReturn(witness.staffId());

        service.dispense(prescription, item.getId(), new DispenseRequest(5, null, witness), actor);

        verify(registerRecorder).recordDispense(any(), eq(PRODUCT_ID), any(), any(), any(), any(), any(), eq(5L),
                eq("LOT-A"), eq(actor.userId()), any(), eq(witness.staffId()));
    }

    @Test
    void witnessWhoFailsConfirmationStopsTheDispense() {
        scheduledProductWithKnownParties(DrugSchedule.S6);
        var witness = new WitnessCredentials(UUID.randomUUID(), "wrong-password");
        when(witnessConfirmation.confirm(actor.userId(), witness))
                .thenThrow(new InvalidWitnessException("The witness could not be confirmed."));

        assertThrows(InvalidWitnessException.class,
                () -> service.dispense(prescription, item.getId(), new DispenseRequest(5, null, witness), actor));

        verify(ledgerPoster, never()).post(any(), any(), any(), anyString(), anyString(), anyList());
    }

    @Test
    void scheduleFiveNeedsNoWitnessAndNeverAsksForOne() {
        scheduledProductWithKnownParties(DrugSchedule.S5);

        service.dispense(prescription, item.getId(), new DispenseRequest(5, null, WitnessCredentials.NONE), actor);

        verify(witnessConfirmation, never()).confirm(any(), any());
    }

    private void scheduledProductWithKnownParties(DrugSchedule schedule) {
        when(scheduleLookup.schedulesFor(any())).thenReturn(Map.of(PRODUCT_ID, schedule));
        Patient patient = mock(Patient.class);
        when(partyDirectory.patients(any())).thenReturn(Map.of(prescription.getPatientId(), patient));
        when(partyDirectory.users(any())).thenReturn(Map.of(prescription.getPrescriberId(), mock(User.class)));
    }

    @Test
    void ordinaryMedicinesNeverTouchTheScheduleRegister() {
        service.dispense(prescription, item.getId(), new DispenseRequest(5, null, WitnessCredentials.NONE), actor);

        verify(registerRecorder, never()).recordDispense(any(), any(), any(), any(), any(), any(), any(), anyLong(), any(), any(), any(), any());
    }

    @Test
    void blockerIsNotMappedWhenNoProductIsKnown() {
        when(substitutionLookup.dispensingProductId(item)).thenReturn(null);

        assertEquals(Optional.of(SkipReason.NOT_MAPPED), service.findBlocker(prescription, item));
    }

    @Test
    void blockerIsNoUsableStockWhenOnlyExpiredLotsRemain() {
        when(lotReader.shelf(FACILITY_ID, PRODUCT_ID)).thenReturn(shelf(lot("OLD", "2026-01-31", 100)));

        assertEquals(Optional.of(SkipReason.NO_USABLE_STOCK), service.findBlocker(prescription, item));
    }

    @Test
    void blockerIsInsufficientStockWhenSomeButNotEnoughIsUsable() {
        when(lotReader.shelf(FACILITY_ID, PRODUCT_ID)).thenReturn(shelf(lot("SMALL", "2027-01-31", 8)));

        assertEquals(Optional.of(SkipReason.INSUFFICIENT_STOCK), service.findBlocker(prescription, item));
    }

    @Test
    void noBlockerWhenUsableStockCoversTheRemainingQuantity() {
        assertEquals(Optional.empty(), service.findBlocker(prescription, item));
    }
}
