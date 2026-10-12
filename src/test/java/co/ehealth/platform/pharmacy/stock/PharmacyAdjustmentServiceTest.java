package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.core.audit.AuditLogService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class PharmacyAdjustmentServiceTest {

    private final UUID facilityId = UUID.randomUUID();
    private final UUID productId = UUID.randomUUID();
    private final UUID batchId = UUID.randomUUID();
    private final UUID locationId = UUID.randomUUID();
    private final StockActor actor = new StockActor(UUID.randomUUID(), "Thandi Pharmacist");

    private final PharmacyProductRepository productRepository = mock(PharmacyProductRepository.class);
    private final PharmacyBatchRepository batchRepository = mock(PharmacyBatchRepository.class);
    private final PharmacyStockAccountRepository accountRepository = mock(PharmacyStockAccountRepository.class);
    private final PharmacyStockEntryRepository entryRepository = mock(PharmacyStockEntryRepository.class);
    private final PharmacyStockLedgerService ledgerService = mock(PharmacyStockLedgerService.class);
    private final PharmacyStockLocationService locationService = mock(PharmacyStockLocationService.class);
    private final SerialUnitGateway serialGateway = mock(SerialUnitGateway.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);

    private PharmacyAdjustmentService service;

    @BeforeEach
    void setUp() {
        service = new PharmacyAdjustmentService(productRepository, batchRepository, accountRepository,
                entryRepository, ledgerService, locationService, serialGateway, auditLogService,
                new StockJson(new ObjectMapper().findAndRegisterModules()));

        PharmacyProduct product = mock(PharmacyProduct.class);
        when(product.getId()).thenReturn(productId);
        when(product.isActive()).thenReturn(true);
        when(product.getDisplayName()).thenReturn("Amoxicillin 500mg");
        when(productRepository.findById(productId)).thenReturn(Optional.of(product));

        PharmacyBatch lot = mock(PharmacyBatch.class);
        when(lot.getId()).thenReturn(batchId);
        when(lot.getProductId()).thenReturn(productId);
        when(lot.getLotNumber()).thenReturn("L1");
        when(batchRepository.findById(batchId)).thenReturn(Optional.of(lot));

        PharmacyStockLocation location = mock(PharmacyStockLocation.class);
        when(location.getId()).thenReturn(locationId);
        when(locationService.getOrCreateMainLocation(facilityId)).thenReturn(location);
        when(ledgerService.findPriorPosting(anyString(), anyString())).thenReturn(Optional.empty());
    }

    private void lotHolds(long quantity) {
        PharmacyStockAccount account = mock(PharmacyStockAccount.class);
        when(account.getQuantity()).thenReturn(quantity);
        when(accountRepository.findByProductIdAndBatchIdAndLocationIdAndBucket(productId, batchId, locationId,
                StockBucket.AVAILABLE)).thenReturn(Optional.of(account));
    }

    private PharmacyAdjustmentService.AdjustmentCommand command(AdjustmentMode mode, int quantity,
                                                                 AdjustmentReason reason, String note) {
        return new PharmacyAdjustmentService.AdjustmentCommand(facilityId, productId, batchId, null, mode, quantity,
                reason, note);
    }

    @Test
    void removingMoreThanTheLotHoldsIsRejectedBeforeAnythingIsPosted() {
        lotHolds(10);

        InvalidStockRequestException error = assertThrows(InvalidStockRequestException.class, () -> service.adjust(
                command(AdjustmentMode.REMOVE, 11, AdjustmentReason.DAMAGED, null), "key-1", actor));

        assertEquals("Only 10 in Amoxicillin 500mg lot L1 — you can't remove 11.", error.getMessage());
        verify(ledgerService, never()).postEntries(any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any());
        verifyNoInteractions(auditLogService);
    }

    @Test
    void otherWithoutANoteIsRejectedBeforeTheBalanceIsRead() {
        assertThrows(InvalidStockRequestException.class, () -> service.adjust(
                command(AdjustmentMode.REMOVE, 1, AdjustmentReason.OTHER, ""), "key-1", actor));

        verifyNoInteractions(accountRepository);
    }

    @Test
    void damagedRemovalPostsOneNegativeWriteOffAndAudits() {
        lotHolds(10);
        UUID transactionId = stubPostedTransaction();

        PharmacyAdjustmentService.AdjustmentResult result = service.adjust(
                command(AdjustmentMode.REMOVE, 4, AdjustmentReason.DAMAGED, " Dropped box "), "key-1", actor);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PharmacyStockLedgerService.EntryRequest>> entries = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<LedgerContext> context = ArgumentCaptor.forClass(LedgerContext.class);
        verify(ledgerService).postEntries(eq(StockTransactionType.WRITE_OFF), eq(facilityId), eq(actor.userId()),
                eq(actor.name()), eq("Dropped box"), isNull(), eq("key-1"), anyString(), context.capture(),
                entries.capture());
        assertEquals(-4, entries.getValue().getFirst().quantityDelta());
        assertEquals("DAMAGED", context.getValue().reasonCode());
        assertEquals(transactionId, result.transactionId());
        verify(auditLogService).append(eq(actor.userId()), eq(facilityId), eq("STOCK_ADJUSTED"), anyString(),
                eq(transactionId.toString()), isNull(), anyString());
    }

    @Test
    void replayedRequestReturnsTheOriginalWithoutRepostingOrAuditingAgain() {
        PharmacyStockTransaction original = stubTransaction(UUID.randomUUID());
        when(ledgerService.findPriorPosting(eq("key-1"), anyString()))
                .thenReturn(Optional.of(original));
        stubEntryFor(original.getId());

        service.adjust(command(AdjustmentMode.REMOVE, 4, AdjustmentReason.DAMAGED, null), "key-1", actor);

        verify(ledgerService, never()).postEntries(any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any());
        verifyNoInteractions(auditLogService);
    }

    private UUID stubPostedTransaction() {
        UUID transactionId = UUID.randomUUID();
        PharmacyStockTransaction transaction = stubTransaction(transactionId);
        when(ledgerService.postEntries(any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(transaction);
        stubEntryFor(transactionId);
        return transactionId;
    }

    private PharmacyStockTransaction stubTransaction(UUID transactionId) {
        PharmacyStockTransaction transaction = mock(PharmacyStockTransaction.class);
        when(transaction.getId()).thenReturn(transactionId);
        when(transaction.getType()).thenReturn(StockTransactionType.WRITE_OFF);
        when(transaction.getCreatedAt()).thenReturn(Instant.parse("2026-10-04T08:00:00Z"));
        return transaction;
    }

    private void stubEntryFor(UUID transactionId) {
        UUID accountId = UUID.randomUUID();
        PharmacyStockEntry entry = new PharmacyStockEntry(transactionId, accountId, -4, 10, 6, Instant.now());
        when(entryRepository.findByTransactionId(transactionId)).thenReturn(List.of(entry));
        PharmacyStockAccount account = mock(PharmacyStockAccount.class);
        when(account.getProductId()).thenReturn(productId);
        when(account.getBatchId()).thenReturn(batchId);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
    }
}
