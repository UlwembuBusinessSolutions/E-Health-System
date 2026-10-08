package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PharmacyStockReversalServiceTest {

    private final UUID facilityId = UUID.randomUUID();
    private final UUID originalId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();
    private final StockActor actor = new StockActor(UUID.randomUUID(), "Thandi Pharmacist");

    private final PharmacyStockTransactionRepository transactionRepository =
            mock(PharmacyStockTransactionRepository.class);
    private final PharmacyStockEntryRepository entryRepository = mock(PharmacyStockEntryRepository.class);
    private final PharmacyStockAccountRepository accountRepository = mock(PharmacyStockAccountRepository.class);
    private final PharmacyProductRepository productRepository = mock(PharmacyProductRepository.class);
    private final PharmacyBatchRepository batchRepository = mock(PharmacyBatchRepository.class);
    private final PharmacyStockLedgerService ledgerService = mock(PharmacyStockLedgerService.class);
    private final SerialUnitGateway serialGateway = mock(SerialUnitGateway.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);

    private StockReversalService service;
    private PharmacyStockTransaction original;

    @BeforeEach
    void setUp() {
        service = new StockReversalService(transactionRepository, entryRepository, accountRepository,
                productRepository, batchRepository, ledgerService, serialGateway, auditLogService,
                new StockJson(new ObjectMapper().findAndRegisterModules()));
        original = originalTransaction(StockTransactionType.RECEIPT);
        when(transactionRepository.existsByReversalOfTransactionId(originalId)).thenReturn(false);
    }

    private PharmacyStockTransaction originalTransaction(StockTransactionType type) {
        PharmacyStockTransaction transaction = mock(PharmacyStockTransaction.class);
        when(transaction.getId()).thenReturn(originalId);
        when(transaction.getType()).thenReturn(type);
        when(transaction.getFacilityId()).thenReturn(facilityId);
        when(transactionRepository.findById(originalId)).thenReturn(Optional.of(transaction));
        return transaction;
    }

    // The original posted `delta` into the lot (seq 7); the lot now holds `balanceNow`.
    private void lotReceived(long delta, long balanceNow, boolean outflowSince) {
        PharmacyStockEntry entry = mock(PharmacyStockEntry.class);
        when(entry.getStockAccountId()).thenReturn(accountId);
        when(entry.getQuantityDelta()).thenReturn(delta);
        when(entry.getSeq()).thenReturn(7L);
        when(entryRepository.findByTransactionId(originalId)).thenReturn(List.of(entry));

        PharmacyStockAccount account = mock(PharmacyStockAccount.class);
        when(account.getId()).thenReturn(accountId);
        when(account.getProductId()).thenReturn(UUID.randomUUID());
        when(account.getBatchId()).thenReturn(UUID.randomUUID());
        when(account.getLocationId()).thenReturn(UUID.randomUUID());
        when(account.getBucket()).thenReturn(StockBucket.AVAILABLE);
        when(account.getQuantity()).thenReturn(balanceNow);
        when(accountRepository.findAllById(any())).thenReturn(List.of(account));

        when(entryRepository.findAccountIdsWithMovementsAfter(anyCollection(), anyLong(), anyCollection()))
                .thenReturn(outflowSince ? List.of(accountId) : List.of());
    }

    @Test
    void reversalIsRejectedWhenSomeOfTheReceivedStockWasDispensed() {
        lotReceived(90, 60, false);

        StockReversalBlockedException error = assertThrows(StockReversalBlockedException.class,
                () -> service.reverse(originalId, ReversalReason.WRONG_ENTRY, null, actor));

        assertTrue(error.getMessage().contains("already been dispensed or written off"));
        verifyNothingPosted();
    }

    @Test
    void reversalIsRejectedWhenALaterOutflowExistsEvenIfTheLotWasRefilled() {
        lotReceived(90, 200, true);

        assertThrows(StockReversalBlockedException.class,
                () -> service.reverse(originalId, ReversalReason.WRONG_ENTRY, null, actor));

        verifyNothingPosted();
    }

    @Test
    void unusedReceiptIsReversedWithTheOppositeLinkedEntry() {
        lotReceived(90, 90, false);
        UUID reversalId = UUID.randomUUID();
        PharmacyStockTransaction reversal = mock(PharmacyStockTransaction.class);
        when(reversal.getId()).thenReturn(reversalId);
        when(ledgerService.postEntries(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(reversal);

        service.reverse(originalId, ReversalReason.DUPLICATE_ENTRY, "Entered twice", actor);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PharmacyStockLedgerService.EntryRequest>> entries = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<LedgerContext> context = ArgumentCaptor.forClass(LedgerContext.class);
        verify(ledgerService).postEntries(eq(StockTransactionType.REVERSAL), eq(facilityId), eq(actor.userId()),
                eq(actor.name()), eq("Entered twice"), isNull(), eq("reversal-of-" + originalId), anyString(),
                context.capture(), entries.capture());
        assertEquals(-90, entries.getValue().getFirst().quantityDelta());
        assertEquals(originalId, context.getValue().reversalOfTransactionId());
        assertEquals("DUPLICATE_ENTRY", context.getValue().reasonCode());
        verify(serialGateway).reverseUnits(originalId, reversalId);
        verify(auditLogService).append(eq(actor.userId()), eq(facilityId), eq("STOCK_REVERSED"), anyString(),
                eq(reversalId.toString()), eq("{\"reversedTransactionId\":\"" + originalId + "\"}"), anyString());
    }

    @Test
    void reversingAWriteOffPutsStockBackWithoutAnyUsedCheck() {
        original = originalTransaction(StockTransactionType.WRITE_OFF);
        lotReceived(-4, 0, true);
        PharmacyStockTransaction reversal = mock(PharmacyStockTransaction.class);
        when(reversal.getId()).thenReturn(UUID.randomUUID());
        when(ledgerService.postEntries(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(reversal);

        service.reverse(originalId, ReversalReason.WRONG_ENTRY, null, actor);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PharmacyStockLedgerService.EntryRequest>> entries = ArgumentCaptor.forClass(List.class);
        verify(ledgerService).postEntries(any(), any(), any(), any(), any(), any(), any(), any(), any(),
                entries.capture());
        assertEquals(4, entries.getValue().getFirst().quantityDelta());
    }

    @Test
    void aTransactionCanOnlyBeReversedOnce() {
        when(transactionRepository.existsByReversalOfTransactionId(originalId)).thenReturn(true);

        assertThrows(TransactionAlreadyReversedException.class,
                () -> service.reverse(originalId, ReversalReason.WRONG_ENTRY, null, actor));
    }

    @Test
    void dispensesAndReversalsCannotBeReversedHere() {
        original = originalTransaction(StockTransactionType.DISPENSE);

        assertThrows(InvalidStockRequestException.class,
                () -> service.reverse(originalId, ReversalReason.WRONG_ENTRY, null, actor));
    }

    @Test
    void otherReasonNeedsANote() {
        assertThrows(InvalidStockRequestException.class,
                () -> service.reverse(originalId, ReversalReason.OTHER, " ", actor));
    }

    @Test
    void unknownTransactionIsNotFound() {
        UUID unknown = UUID.randomUUID();
        when(transactionRepository.findById(unknown)).thenReturn(Optional.empty());

        assertThrows(StockTransactionNotFoundException.class,
                () -> service.reverse(unknown, ReversalReason.WRONG_ENTRY, null, actor));
    }

    @Test
    void usedStockRuleOnlyAppliesToMovementsThatAddedStock() {
        assertTrue(ReversalRules.isStockUsed(90, 60, false));
        assertTrue(ReversalRules.isStockUsed(90, 90, true));
        assertFalse(ReversalRules.isStockUsed(90, 90, false));
        assertFalse(ReversalRules.isStockUsed(-4, 0, true));
        assertEquals(Set.of(StockTransactionType.DISPENSE, StockTransactionType.WRITE_OFF,
                StockTransactionType.ADJUSTMENT_NEGATIVE, StockTransactionType.TRANSFER_DISPATCH),
                ReversalRules.STOCK_OUTFLOW_TYPES);
    }

    private void verifyNothingPosted() {
        verify(ledgerService, never()).postEntries(any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any());
        verify(serialGateway, never()).reverseUnits(any(), any());
        verify(auditLogService, never()).append(any(), any(), any(), any(), any(), any(), any());
    }
}
