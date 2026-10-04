package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.PharmacyTestData;
import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RegisterProductListServiceTest {

    private final RegisterProductRepository productRepository = mock(RegisterProductRepository.class);
    private final ScheduleRegisterEntryRepository entryRepository = mock(ScheduleRegisterEntryRepository.class);
    private final RegisterProductListService service = new RegisterProductListService(productRepository,
            entryRepository);

    private final UUID facilityId = UUID.randomUUID();

    private ScheduleRegisterEntry latestEntry(PharmacyProduct product, long balanceAfter, String lot) {
        var details = new RegisterEntryDetails(facilityId, product.getId(), RegisterEntryKind.RECEIVED, 10, null,
                null, null, null, null, lot, RegisterTestFixtures.ACTOR, null, null, null);
        return new ScheduleRegisterEntry(details, balanceAfter, RegisterTestFixtures.NOW);
    }

    @Test
    void onHandIsTheBalanceAfterTheLatestEntryAndCurrentLotIsThatEntrysLot() {
        PharmacyProduct morphine = PharmacyTestData.quantityOnlyProduct("MOR-10", "Morphine 10 mg");
        when(productRepository.findScheduledAtFacility(facilityId)).thenReturn(List.of(morphine));
        when(entryRepository.findLatestEntries(any(), any())).thenReturn(List.of(latestEntry(morphine, 24, "LOT-9")));

        List<RegisterProductListService.RegisterProduct> products = service.productsAt(facilityId);

        assertEquals(1, products.size());
        assertEquals(new RegisterProductListService.RegisterProduct(morphine.getId(), "Morphine 10 mg", "MOR-10",
                DrugSchedule.S5, 24, "LOT-9"), products.getFirst());
    }

    @Test
    void productWithNoRegisterEntriesYetHasNothingOnHandAndNoLot() {
        PharmacyProduct newProduct = PharmacyTestData.quantityOnlyProduct("PET-1", "Pethidine 50 mg");
        when(productRepository.findScheduledAtFacility(facilityId)).thenReturn(List.of(newProduct));
        when(entryRepository.findLatestEntries(any(), any())).thenReturn(List.of());

        RegisterProductListService.RegisterProduct product = service.productsAt(facilityId).getFirst();

        assertEquals(0, product.onHand());
        assertNull(product.currentLot());
    }

    @Test
    void emptiedRegisterHasNoCurrentLot() {
        PharmacyProduct emptied = PharmacyTestData.quantityOnlyProduct("COD-1", "Codeine 30 mg");
        when(productRepository.findScheduledAtFacility(facilityId)).thenReturn(List.of(emptied));
        when(entryRepository.findLatestEntries(any(), any())).thenReturn(List.of(latestEntry(emptied, 0, "LOT-OLD")));

        assertNull(service.productsAt(facilityId).getFirst().currentLot());
    }

    @Test
    void noScheduledProductsMeansNoRegisterLookup() {
        when(productRepository.findScheduledAtFacility(facilityId)).thenReturn(List.of());

        assertTrue(service.productsAt(facilityId).isEmpty());
    }
}
