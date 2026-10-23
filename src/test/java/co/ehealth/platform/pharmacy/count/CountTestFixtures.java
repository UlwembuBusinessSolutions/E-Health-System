package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.ProductHandling;
import co.ehealth.platform.pharmacy.stock.StockBaseUnit;
import co.ehealth.platform.pharmacy.stock.StockCategory;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

// Entities get their ids from JPA, so tests that never touch a database
// assign them directly.
final class CountTestFixtures {

    static final Instant NOW = Instant.parse("2026-10-04T08:00:00Z");
    static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private CountTestFixtures() {
    }

    static PharmacyStockCount draftCount(boolean blind) {
        PharmacyStockCount count = new PharmacyStockCount(UUID.randomUUID(), UUID.randomUUID(), CountScope.ALL,
                null, blind, UUID.randomUUID(), "Sipho Dlamini", NOW);
        ReflectionTestUtils.setField(count, "id", UUID.randomUUID());
        return count;
    }

    static PharmacyStockCountLine ledgerLine(PharmacyStockCount count, UUID productId, UUID batchId, String lot) {
        PharmacyStockCountLine line = PharmacyStockCountLine.forLedgerLot(count.getId(), productId, batchId, lot,
                LocalDate.of(2027, 5, 31));
        ReflectionTestUtils.setField(line, "id", UUID.randomUUID());
        return line;
    }

    static PharmacyStockCountLine countedLine(PharmacyStockCount count, UUID productId, UUID batchId,
                                              long baseline, long counted) {
        PharmacyStockCountLine line = ledgerLine(count, productId, batchId, "LOT-" + baseline);
        line.recordCount(counted, baseline, NOW);
        return line;
    }

    static PharmacyProduct product(UUID id, String name) {
        PharmacyProduct product = new PharmacyProduct("P-" + name, name, null, null, null, StockCategory.MEDICINE,
                StockBaseUnit.TABLET, null, null, null, true, true, null, new ProductHandling(false, null, false, null),
                UUID.randomUUID(), "Admin", NOW);
        ReflectionTestUtils.setField(product, "id", id);
        return product;
    }
}
