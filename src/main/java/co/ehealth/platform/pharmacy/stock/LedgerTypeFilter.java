package co.ehealth.platform.pharmacy.stock;

import java.util.Arrays;
import java.util.List;

// Reads the ledger's `type` query parameter: one transaction type or a
// comma-separated list of them. No parameter means every type, which lets
// the repository always bind a non-empty IN list.
final class LedgerTypeFilter {

    private static final List<StockTransactionType> EVERY_TYPE = List.of(StockTransactionType.values());

    private LedgerTypeFilter() {
    }

    static List<StockTransactionType> parse(String commaSeparatedTypes) {
        if (commaSeparatedTypes == null) {
            return EVERY_TYPE;
        }
        List<StockTransactionType> named = Arrays.stream(commaSeparatedTypes.split(","))
                .map(String::trim)
                .filter(name -> !name.isEmpty())
                .map(LedgerTypeFilter::typeNamed)
                .distinct()
                .toList();
        return named.isEmpty() ? EVERY_TYPE : named;
    }

    private static StockTransactionType typeNamed(String name) {
        try {
            return StockTransactionType.valueOf(name.toUpperCase());
        } catch (IllegalArgumentException unknownName) {
            throw new InvalidStockRequestException("\"" + name + "\" is not a stock movement type.");
        }
    }
}
