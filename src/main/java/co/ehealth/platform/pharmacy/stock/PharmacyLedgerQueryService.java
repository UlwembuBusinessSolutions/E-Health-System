package co.ehealth.platform.pharmacy.stock;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Read side of the ledger: the filterable facility-wide listing and a single
// product's history with a running balance. Never writes anything.
@Service
public class PharmacyLedgerQueryService {

    // An open-ended date range as concrete instants — see
    // PharmacyStockEntryRepository.LEDGER_FROM for why not NULL.
    private static final Instant BEGINNING_OF_TIME = Instant.EPOCH;
    private static final Instant END_OF_TIME = Instant.parse("3000-01-01T00:00:00Z");

    private final PharmacyStockEntryRepository stockEntryRepository;
    private final LedgerRowAssembler rowAssembler;
    private final Clock clock;

    public PharmacyLedgerQueryService(PharmacyStockEntryRepository stockEntryRepository,
                                      LedgerRowAssembler rowAssembler, Clock clock) {
        this.stockEntryRepository = stockEntryRepository;
        this.rowAssembler = rowAssembler;
        this.clock = clock;
    }

    // Every filter is optional. from/to are whole calendar days, both
    // inclusive, in the server's clock zone.
    public record LedgerFilter(UUID facilityId, UUID productId, List<StockTransactionType> types, UUID supplierId,
                               UUID patientId, String q, LocalDate from, LocalDate to) {
    }

    public Page<LedgerRow> listLedger(LedgerFilter filter, int page, int size) {
        Pageable pageable = StockListParams.pageable(page, size);
        Page<PharmacyStockEntry> entries = stockEntryRepository.findLedger(filter.facilityId(), filter.productId(),
                filter.types(), filter.supplierId(), filter.patientId(),
                StockListParams.searchTerm(filter.q()), startOf(filter.from()), endOfDay(filter.to()), pageable);
        return new PageImpl<>(rowAssembler.assemble(entries.getContent()), pageable, entries.getTotalElements());
    }

    public Page<LedgerRow> listProductHistory(UUID facilityId, UUID productId, int page, int size) {
        var filter = new LedgerFilter(facilityId, productId, LedgerTypeFilter.parse(null), null, null, null, null,
                null);
        Page<LedgerRow> ledger = listLedger(filter, page, size);
        return new PageImpl<>(withRunningBalances(ledger.getContent(), facilityId, productId), ledger.getPageable(),
                ledger.getTotalElements());
    }

    // Counts per type under the same filters except the type filter, keyed by
    // type name. Types with no entries are left out.
    public Map<String, Long> typeCounts(LedgerFilter filter) {
        return stockEntryRepository.countByType(filter.facilityId(), filter.productId(), filter.supplierId(),
                        filter.patientId(), StockListParams.searchTerm(filter.q()), startOf(filter.from()),
                        endOfDay(filter.to())).stream()
                .collect(Collectors.toMap(typeCount -> typeCount.type().name(), LedgerTypeCount::count));
    }

    // Rows arrive newest first. The newest row's balance is the sum of every
    // movement up to it; each older row's balance is the previous row's
    // balance minus the previous row's own movement.
    private List<LedgerRow> withRunningBalances(List<LedgerRow> newestFirst, UUID facilityId, UUID productId) {
        if (newestFirst.isEmpty()) {
            return newestFirst;
        }
        long balance = stockEntryRepository.sumQuantityDeltaUpTo(facilityId, productId,
                newestFirst.getFirst().entry().getSeq());
        List<LedgerRow> withBalances = new ArrayList<>();
        for (LedgerRow row : newestFirst) {
            withBalances.add(row.withRunningBalance(balance));
            balance -= row.entry().getQuantityDelta();
        }
        return withBalances;
    }

    private Instant startOf(LocalDate day) {
        return day == null ? BEGINNING_OF_TIME : day.atStartOfDay(clock.getZone()).toInstant();
    }

    // Exclusive upper bound: the start of the day after the inclusive "to".
    private Instant endOfDay(LocalDate day) {
        return day == null ? END_OF_TIME : day.plusDays(1).atStartOfDay(clock.getZone()).toInstant();
    }
}
