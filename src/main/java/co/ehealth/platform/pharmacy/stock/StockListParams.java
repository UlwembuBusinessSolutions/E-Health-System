package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

// Normalisation shared by the stock list endpoints so paging and search
// behave identically on the Stock page, the Ledger and the expiry list.
final class StockListParams {

    static final int MAX_PAGE_SIZE = 100;

    private StockListParams() {
    }

    static Pageable pageable(int page, int size) {
        return PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), MAX_PAGE_SIZE));
    }

    // Lower-cased once here because every search query compares against
    // LOWER(column); '' means "no search" (see the repositories' notes).
    static String searchTerm(String q) {
        return q == null ? "" : q.trim().toLowerCase();
    }
}
