package co.ehealth.platform.pharmacy.prescribing;

import co.ehealth.platform.pharmacy.PharmacyTestData;
import co.ehealth.platform.pharmacy.PurchaseReason;
import co.ehealth.platform.pharmacy.dispensing.LotAvailability;
import co.ehealth.platform.pharmacy.dispensing.StockLotReader;
import co.ehealth.platform.pharmacy.dispensing.StockPicture;
import co.ehealth.platform.pharmacy.dispensing.StockSnapshot;
import co.ehealth.platform.pharmacy.prescribing.PrescribingStockService.StockLine;
import co.ehealth.platform.pharmacy.stock.PharmacyProduct;
import co.ehealth.platform.pharmacy.stock.PharmacyProductRepository;
import co.ehealth.platform.pharmacy.stock.PharmacyValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PrescribingStockServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 4);

    private final UUID facilityId = UUID.randomUUID();
    private final PharmacyProductRepository productRepository = mock(PharmacyProductRepository.class);
    private final StockLotReader lotReader = mock(StockLotReader.class);
    private final PrescribingStockService service = new PrescribingStockService(null, null, productRepository, null,
            lotReader);

    private PharmacyProduct amoxicillin;

    @BeforeEach
    void setUp() {
        amoxicillin = PharmacyTestData.lotTrackedProduct("AMOX-500-CAP", "Amoxicillin 500 mg");
        when(productRepository.findAllById(anyCollection())).thenReturn(List.of(amoxicillin));
        when(productRepository.findById(amoxicillin.getId())).thenReturn(Optional.of(amoxicillin));
    }

    // A shelf holding the given units in one lot that expires well after TODAY.
    private void shelfHolds(long units, LocalDate expiry) {
        LotAvailability lot = new LotAvailability(facilityId, amoxicillin.getId(), UUID.randomUUID(),
                UUID.randomUUID(), "L1", expiry, units);
        StockPicture picture = StockPicture.of(units == 0 ? List.of() : List.of(lot), TODAY);
        StockSnapshot snapshot = mock(StockSnapshot.class);
        when(snapshot.shelf(any(), any())).thenReturn(picture);
        when(lotReader.snapshot(Set.of(facilityId), Set.of(amoxicillin.getId()))).thenReturn(snapshot);
        when(lotReader.shelf(facilityId, amoxicillin.getId())).thenReturn(picture);
    }

    @Test
    void aPrescriptionWithinWhatTheShelfHoldsIsAccepted() {
        shelfHolds(20, TODAY.plusDays(300));

        service.requireCovered(facilityId, List.of(new StockLine(amoxicillin.getId(), 20)));
    }

    @Test
    void askingForMoreThanTheShelfHoldsIsRefusedWithTheFigures() {
        shelfHolds(20, TODAY.plusDays(300));

        assertThatThrownBy(() -> service.requireCovered(facilityId, List.of(new StockLine(amoxicillin.getId(), 60))))
                .isInstanceOf(PharmacyValidationException.class)
                .hasMessageContaining("Only 20 of Amoxicillin 500 mg").hasMessageContaining("you asked for 60");
    }

    @Test
    void linesForTheSameProductAreAddedTogether() {
        shelfHolds(20, TODAY.plusDays(300));

        assertThatThrownBy(() -> service.requireCovered(facilityId,
                List.of(new StockLine(amoxicillin.getId(), 15), new StockLine(amoxicillin.getId(), 15))))
                .isInstanceOf(PharmacyValidationException.class);
    }

    @Test
    void expiredStockDoesNotCount() {
        shelfHolds(20, TODAY.minusDays(1));

        assertThatThrownBy(() -> service.requireCovered(facilityId, List.of(new StockLine(amoxicillin.getId(), 1))))
                .isInstanceOf(PharmacyValidationException.class).hasMessageContaining("out of stock");
    }

    @Test
    void anOutOfStockMedicineCanBeOnTheBuyListAndIsMarkedOutOfStock() {
        shelfHolds(0, TODAY);

        assertThat(service.classifyPurchase(facilityId, amoxicillin.getId(), 30, 0)).isEqualTo(PurchaseReason.OUT_OF_STOCK);
    }

    @Test
    void theRestOfASplitIsShortStockNotAnError() {
        shelfHolds(20, TODAY.plusDays(300));

        assertThat(service.classifyPurchase(facilityId, amoxicillin.getId(), 15, 20)).isEqualTo(PurchaseReason.SHORT_STOCK);
    }

    @Test
    void aBuyLineTheShelfCouldStillCoverIsRefused() {
        shelfHolds(100, TODAY.plusDays(300));

        assertThatThrownBy(() -> service.classifyPurchase(facilityId, amoxicillin.getId(), 10, 10))
                .isInstanceOf(PharmacyValidationException.class).hasMessageContaining("is in stock");
    }

    @Test
    void aTypedMedicineIsSimplyNotStocked() {
        assertThat(service.classifyPurchase(facilityId, null, 10, 0)).isEqualTo(PurchaseReason.NOT_STOCKED);
        ReflectionTestUtils.setField(amoxicillin, "active", true);
    }
}
