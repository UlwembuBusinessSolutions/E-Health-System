package co.ehealth.platform.pharmacy.stock;

import co.ehealth.platform.patient.PatientRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

// The ledger flags a received lot as "stock used" with the same rule that
// blocks its reversal, decided for a whole page from one outflow query.
class LedgerStockUsedTest {

    private final PharmacyStockAccountRepository accountRepository = mock(PharmacyStockAccountRepository.class);
    private final PharmacyStockTransactionRepository transactionRepository =
            mock(PharmacyStockTransactionRepository.class);
    private final PharmacyStockEntryRepository entryRepository = mock(PharmacyStockEntryRepository.class);
    private final PharmacyProductRepository productRepository = mock(PharmacyProductRepository.class);
    private final PharmacyBatchRepository batchRepository = mock(PharmacyBatchRepository.class);
    private final LedgerRowAssembler assembler = new LedgerRowAssembler(accountRepository, productRepository,
            batchRepository, transactionRepository, entryRepository, mock(PatientRepository.class),
            mock(SupplierNameLookup.class));

    private final UUID accountId = UUID.randomUUID();
    private final UUID transactionId = UUID.randomUUID();

    private LedgerRow rowFor(StockTransactionType type, long delta, long seq, long balanceNow,
                             Long latestOutflowSeq) {
        PharmacyStockEntry entry = mock(PharmacyStockEntry.class);
        when(entry.getStockAccountId()).thenReturn(accountId);
        when(entry.getTransactionId()).thenReturn(transactionId);
        when(entry.getQuantityDelta()).thenReturn(delta);
        when(entry.getSeq()).thenReturn(seq);

        PharmacyStockAccount account = mock(PharmacyStockAccount.class);
        when(account.getId()).thenReturn(accountId);
        when(account.getProductId()).thenReturn(UUID.randomUUID());
        when(account.getBatchId()).thenReturn(UUID.randomUUID());
        when(account.getQuantity()).thenReturn(balanceNow);
        when(accountRepository.findAllById(anyCollection())).thenReturn(List.of(account));

        PharmacyStockTransaction transaction = mock(PharmacyStockTransaction.class);
        when(transaction.getId()).thenReturn(transactionId);
        when(transaction.getType()).thenReturn(type);
        when(transactionRepository.findAllById(anyCollection())).thenReturn(List.of(transaction));
        when(transactionRepository.findByReversalOfTransactionIdIn(any())).thenReturn(List.of());
        when(productRepository.findAllById(anyCollection())).thenReturn(List.of());
        when(batchRepository.findAllById(anyCollection())).thenReturn(List.of());

        List<AccountOutflow> outflows = latestOutflowSeq == null ? List.of()
                : List.of(new AccountOutflow(accountId, latestOutflowSeq));
        when(entryRepository.findLatestOutflowByAccount(any(), any())).thenReturn(outflows);
        return assembler.assemble(List.of(entry)).getFirst();
    }

    @Test
    void receiptWhoseLotWasDispensedLaterIsUsed() {
        assertTrue(rowFor(StockTransactionType.RECEIPT, 90, 10, 90, 12L).stockUsed());
    }

    @Test
    void receiptWhoseLotHasOnlyBeenToppedUpSinceIsNotUsed() {
        assertFalse(rowFor(StockTransactionType.RECEIPT, 90, 10, 120, null).stockUsed());
    }

    @Test
    void outflowBeforeTheReceiptDoesNotCount() {
        assertFalse(rowFor(StockTransactionType.RECEIPT, 90, 10, 90, 4L).stockUsed());
    }

    @Test
    void lotBelowWhatWasReceivedIsUsedEvenWithoutARecordedOutflow() {
        assertTrue(rowFor(StockTransactionType.OPENING_BALANCE, 50, 3, 20, null).stockUsed());
    }

    @Test
    void movementsThatCannotBeReversedAreNeverFlagged() {
        assertFalse(rowFor(StockTransactionType.DISPENSE, -5, 10, 0, 12L).stockUsed());
        assertFalse(rowFor(StockTransactionType.REVERSAL, 90, 10, 0, 12L).stockUsed());
    }
}
