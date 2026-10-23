package co.ehealth.platform.pharmacy;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.ProductHandling;
import co.ehealth.platform.pharmacy.stock.StockBaseUnit;
import co.ehealth.platform.pharmacy.stock.StockCategory;
import co.ehealth.platform.pharmacy.supplier.PharmacySupplier;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

// Builders for the persisted-entity fixtures the unit tests share. Ids are
// normally database-generated, so the builders assign one by reflection.
public final class PharmacyTestData {

    // 2026-10-04 12:00 UTC — every date rule in the tests is relative to this.
    public static final Clock CLOCK = Clock.fixed(Instant.parse("2026-10-04T12:00:00Z"), ZoneOffset.UTC);

    private PharmacyTestData() {
    }

    public static PharmacyProduct lotTrackedProduct(String code, String name) {
        return product(code, name, true, true, new ProductHandling(false, null, false, null));
    }

    public static PharmacyProduct coldChainProduct(String code, String name) {
        return product(code, name, true, true, new ProductHandling(false, null, true, null));
    }

    public static PharmacyProduct serialProduct(String code, String name) {
        return product(code, name, false, false, new ProductHandling(true, null, false, null));
    }

    public static PharmacyProduct quantityOnlyProduct(String code, String name) {
        return product(code, name, false, false, new ProductHandling(false, DrugSchedule.S5, false, null));
    }

    public static PharmacyProduct product(String code, String name, boolean batchTracked, boolean expiryTracked,
                                          ProductHandling handling) {
        PharmacyProduct product = new PharmacyProduct(code, name, null, null, null, StockCategory.MEDICINE,
                StockBaseUnit.TABLET, null, null, null, batchTracked, expiryTracked, null, handling, UUID.randomUUID(),
                "Test Pharmacist", CLOCK.instant());
        ReflectionTestUtils.setField(product, "id", UUID.randomUUID());
        return product;
    }

    public static PharmacySupplier supplier(String name) {
        PharmacySupplier supplier = new PharmacySupplier(name, null, null, UUID.randomUUID(), CLOCK.instant());
        ReflectionTestUtils.setField(supplier, "id", UUID.randomUUID());
        return supplier;
    }
}
