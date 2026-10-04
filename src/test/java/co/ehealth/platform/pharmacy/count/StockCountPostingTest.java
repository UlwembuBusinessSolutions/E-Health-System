package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.pharmacy.stock.PharmacyBatch;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLedgerService;
import co.ehealth.platform.pharmacy.stock.StockTransactionType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static co.ehealth.platform.pharmacy.count.CountTestFixtures.CLOCK;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.countedLine;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.draftCount;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.ledgerLine;
import static co.ehealth.platform.pharmacy.count.CountTestFixtures.product;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StockCountPostingTest {

    private final PharmacyStockCountRepository countRepository = mock(PharmacyStockCountRepository.class);
    private final PharmacyStockCountLineRepository lineRepository = mock(PharmacyStockCountLineRepository.class);
    private final PharmacyProductRepository productRepository = mock(PharmacyProductRepository.class);
    private final PharmacyStockLedgerService ledger = mock(PharmacyStockLedgerService.class);
    private final FoundLotBatches foundLotBatches = mock(FoundLotBatches.class);
    private final StockCountPostingService service = new StockCountPostingService(countRepository, lineRepository,
            productRepository, ledger, foundLotBatches, new StockCountLookup(countRepository, lineRepository),
            mock(AuditLogService.class), CLOCK);

    private final UUID actorId = UUID.randomUUID();
    private final UUID productId = UUID.randomUUID();
    private PharmacyStockCount count;

    @BeforeEach
    void openDraftCount() {
        count = draftCount(false);
        when(countRepository.findByIdForUpdate(count.getId())).thenReturn(Optional.of(count));
        when(countRepository.nextReferenceSequenceValue()).thenReturn(12L);
    }

    private void countHasLines(PharmacyStockCountLine... lines) {
        when(lineRepository.findByCountId(count.getId())).thenReturn(List.of(lines));
    }

    private PharmacyStockCountLine reasoned(PharmacyStockCountLine line) {
        line.recordReason("Counted twice");
        return line;
    }

    private ArgumentCaptor<List<PharmacyStockLedgerService.EntryRequest>> postedEntries(StockTransactionType type,
                                                                                         int times) {
        ArgumentCaptor<List<PharmacyStockLedgerService.EntryRequest>> entries = ArgumentCaptor.forClass(List.class);
        verify(ledger, times(times)).postEntries(eq(type), eq(count.getFacilityId()), eq(actorId), anyString(),
                anyString(), eq("CNT-000012"), anyString(), anyString(), entries.capture());
        return entries;
    }

    @Test
    void refusesToPostWhileAVarianceLineHasNoReasonAndNamesTheLines() {
        PharmacyStockCountLine missing = countedLine(count, productId, UUID.randomUUID(), 10, 7);
        PharmacyStockCountLine explained = reasoned(countedLine(count, productId, UUID.randomUUID(), 5, 6));
        countHasLines(missing, explained);
        when(productRepository.findAllById(any())).thenReturn(List.of(product(productId, "Paracetamol")));

        MissingCountReasonsException refusal = assertThrows(MissingCountReasonsException.class,
                () -> service.post(count.getId(), actorId, "Sipho Dlamini"));

        assertEquals(List.of(missing.getId().toString()), List.copyOf(refusal.getLinesWithoutReason().keySet()));
        verify(ledger, never()).postEntries(any(), any(), any(), any(), any(), any(), any(), any(), anyList());
        assertTrue(count.isDraft());
    }

    @Test
    void postsCountedMinusBaselineAsOneAdjustmentPerVarianceLine() {
        PharmacyStockCountLine shortage = reasoned(countedLine(count, productId, UUID.randomUUID(), 10, 7));
        PharmacyStockCountLine surplus = reasoned(countedLine(count, productId, UUID.randomUUID(), 5, 9));
        PharmacyStockCountLine match = countedLine(count, productId, UUID.randomUUID(), 8, 8);
        PharmacyStockCountLine uncounted = ledgerLine(count, productId, UUID.randomUUID(), "LOT-UNCOUNTED");
        countHasLines(shortage, surplus, match, uncounted);

        service.post(count.getId(), actorId, "Sipho Dlamini");

        assertEquals(-3L, postedEntries(StockTransactionType.ADJUSTMENT_NEGATIVE, 1).getValue().get(0)
                .quantityDelta());
        assertEquals(4L, postedEntries(StockTransactionType.ADJUSTMENT_POSITIVE, 1).getValue().get(0)
                .quantityDelta());
        verify(ledger, times(2)).postEntries(any(), any(), any(), any(), any(), any(), any(), any(), anyList());
        assertTrue(count.isPosted());
        assertEquals("CNT-000012", count.getReference());
    }

    @Test
    void foundLotIsCreatedFirstAndPostedAsAPositiveAdjustment() {
        PharmacyStockCountLine found = reasoned(PharmacyStockCountLine.forFoundLot(count.getId(), productId,
                "NEW-LOT", LocalDate.of(2027, 1, 31), 12, CLOCK.instant()));
        ReflectionTestUtils.setField(found, "id", UUID.randomUUID());
        UUID newBatchId = UUID.randomUUID();
        PharmacyBatch newBatch = mock(PharmacyBatch.class);
        when(newBatch.getId()).thenReturn(newBatchId);
        when(foundLotBatches.resolveOrCreate(found, actorId, "Sipho Dlamini")).thenReturn(newBatch);
        countHasLines(found);

        service.post(count.getId(), actorId, "Sipho Dlamini");

        PharmacyStockLedgerService.EntryRequest entry = postedEntries(StockTransactionType.ADJUSTMENT_POSITIVE, 1)
                .getValue().get(0);
        assertEquals(newBatchId, entry.batchId());
        assertEquals(12L, entry.quantityDelta());
    }

    @Test
    void postingAnAlreadyPostedCountDoesNothing() {
        count.markPosted("CNT-000009", actorId, "Sipho Dlamini", CLOCK.instant());

        service.post(count.getId(), actorId, "Sipho Dlamini");

        verify(ledger, never()).postEntries(any(), any(), any(), any(), any(), any(), any(), any(), anyList());
        verify(countRepository, never()).nextReferenceSequenceValue();
        assertEquals("CNT-000009", count.getReference());
    }

    @Test
    void aCancelledCountCannotBePosted() {
        count.cancel();

        assertThrows(InvalidStockCountStateException.class,
                () -> service.post(count.getId(), actorId, "Sipho Dlamini"));
    }

    @Test
    void idempotencyKeyIsDerivedFromCountAndLineSoAReplayIsRecognisedByTheLedger() {
        PharmacyStockCountLine line = reasoned(countedLine(count, productId, UUID.randomUUID(), 10, 7));
        countHasLines(line);

        service.post(count.getId(), actorId, "Sipho Dlamini");

        ArgumentCaptor<String> key = ArgumentCaptor.forClass(String.class);
        verify(ledger).postEntries(any(), any(), any(), any(), any(), any(), key.capture(), anyString(), anyList());
        assertEquals("stock-count-" + count.getId() + "-line-" + line.getId(), key.getValue());
    }

    @Test
    void nothingToPostWhenNoLineWasCounted() {
        countHasLines(ledgerLine(count, productId, UUID.randomUUID(), "LOT-A"));

        assertThrows(InvalidStockCountException.class, () -> service.post(count.getId(), actorId, "Sipho"));
        verify(ledger, never()).postEntries(any(), any(), any(), any(), any(), any(), any(), any(), anyList());
    }
}
