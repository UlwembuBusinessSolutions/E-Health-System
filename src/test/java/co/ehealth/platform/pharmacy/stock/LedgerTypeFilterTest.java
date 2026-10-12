package co.ehealth.platform.pharmacy.stock;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LedgerTypeFilterTest {

    @Test
    void noParameterMeansEveryType() {
        assertEquals(List.of(StockTransactionType.values()), LedgerTypeFilter.parse(null));
    }

    @Test
    void blankOrOnlyCommasAlsoMeanEveryType() {
        assertEquals(List.of(StockTransactionType.values()), LedgerTypeFilter.parse("  "));
        assertEquals(List.of(StockTransactionType.values()), LedgerTypeFilter.parse(" , ,"));
    }

    @Test
    void singleTypeIsParsed() {
        assertEquals(List.of(StockTransactionType.RECEIPT), LedgerTypeFilter.parse("RECEIPT"));
    }

    @Test
    void commaSeparatedTypesKeepTheirOrderAndIgnoreSpacesAndCase() {
        assertEquals(List.of(StockTransactionType.DISPENSE, StockTransactionType.WRITE_OFF,
                StockTransactionType.REVERSAL), LedgerTypeFilter.parse("DISPENSE, write_off ,REVERSAL"));
    }

    @Test
    void repeatedTypesAreCollapsed() {
        assertEquals(List.of(StockTransactionType.RECEIPT), LedgerTypeFilter.parse("RECEIPT,RECEIPT"));
    }

    @Test
    void unknownTypeIsRefusedWithAMessageNamingIt() {
        InvalidStockRequestException refusal = assertThrows(InvalidStockRequestException.class,
                () -> LedgerTypeFilter.parse("RECEIPT,SHRINKAGE"));

        assertEquals("\"SHRINKAGE\" is not a stock movement type.", refusal.getMessage());
    }
}
