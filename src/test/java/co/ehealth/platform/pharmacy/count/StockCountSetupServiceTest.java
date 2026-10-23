package co.ehealth.platform.pharmacy.count;

import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyStockAccount;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLocation;
import co.ehealth.platform.pharmacy.stock.PharmacyStockLocationService;
import co.ehealth.platform.pharmacy.stock.StockBucket;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static co.ehealth.platform.pharmacy.count.CountTestFixtures.NOW;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StockCountSetupServiceTest {

    private final FacilityRepository facilityRepository = mock(FacilityRepository.class);
    private final PharmacyStockLocationService locationService = mock(PharmacyStockLocationService.class);
    private final CountStockAccountRepository accountRepository = mock(CountStockAccountRepository.class);
    private final PharmacyProductRepository productRepository = mock(PharmacyProductRepository.class);
    private final PharmacyStockCountRepository countRepository = mock(PharmacyStockCountRepository.class);
    private final StockCountSetupService service = new StockCountSetupService(facilityRepository, locationService,
            accountRepository, productRepository, countRepository);

    private final UUID facilityId = UUID.randomUUID();
    private final UUID locationId = UUID.randomUUID();

    private PharmacyProduct productStoredAt(String storage) {
        PharmacyProduct product = CountTestFixtures.product(UUID.randomUUID(), "Product " + storage);
        ReflectionTestUtils.setField(product, "storageInstructions", storage);
        return product;
    }

    private PharmacyStockAccount lotOf(PharmacyProduct product) {
        return new PharmacyStockAccount(product.getId(), UUID.randomUUID(), locationId, StockBucket.AVAILABLE);
    }

    private void facilityHolds(PharmacyProduct... products) {
        when(facilityRepository.existsById(facilityId)).thenReturn(true);
        PharmacyStockLocation location = mock(PharmacyStockLocation.class);
        when(location.getId()).thenReturn(locationId);
        when(locationService.getOrCreateMainLocation(facilityId)).thenReturn(location);
        when(accountRepository.findStocked(locationId, StockBucket.AVAILABLE))
                .thenReturn(java.util.Arrays.stream(products).map(this::lotOf).toList());
        when(productRepository.findAllById(any())).thenReturn(List.of(products));
    }

    @Test
    void wholeFacilityCountsEveryStockedLotAndAreasComeFromStorageInstructions() {
        facilityHolds(productStoredAt("Fridge"), productStoredAt("Fridge"), productStoredAt("Shelf B"));
        when(countRepository.latestPostedAreaCounts(facilityId)).thenReturn(List.of());

        CountSetupResponse setup = service.setup(facilityId);

        assertEquals(3, setup.wholeFacilityLots());
        assertEquals(List.of(new CountSetupResponse.AreaSummary("Fridge", 2, null),
                new CountSetupResponse.AreaSummary("Shelf B", 1, null)), setup.areas());
    }

    @Test
    void lastCountedAtIsTheLatestPostedCountOfThatAreaIgnoringCase() {
        facilityHolds(productStoredAt("Fridge"), productStoredAt("Shelf B"));
        Instant earlier = NOW.minusSeconds(86_400);
        when(countRepository.latestPostedAreaCounts(facilityId)).thenReturn(List.of(
                new AreaLastCounted("fridge", earlier), new AreaLastCounted("FRIDGE", NOW)));

        List<CountSetupResponse.AreaSummary> areas = service.setup(facilityId).areas();

        assertEquals(NOW, areas.get(0).lastCountedAt());
        assertNull(areas.get(1).lastCountedAt());
    }

    @Test
    void unknownFacilityIsRefused() {
        when(facilityRepository.existsById(facilityId)).thenReturn(false);

        assertThrows(FacilityNotFoundException.class, () -> service.setup(facilityId));
    }
}
