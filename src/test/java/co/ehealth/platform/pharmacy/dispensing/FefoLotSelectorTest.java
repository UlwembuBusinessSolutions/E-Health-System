package co.ehealth.platform.pharmacy.dispensing;

import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.lot;
import static co.ehealth.platform.pharmacy.dispensing.DispensingTestData.shelf;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class FefoLotSelectorTest {

    private final FefoLotSelector selector = new FefoLotSelector();

    @Test
    void picksTheEarliestExpiringLotThatIsStillInDate() {
        LotAvailability later = lot("LATE", "2027-06-30", 50);
        LotAvailability earlier = lot("EARLY", "2026-12-31", 50);

        List<LotDraw> draws = selector.allocate(shelf(later, earlier), 10, null);

        assertEquals(1, draws.size());
        assertEquals("EARLY", draws.get(0).lot().lotNumber());
        assertEquals(10, draws.get(0).quantity());
    }

    @Test
    void neverDrawsFromAnExpiredLotEvenWhenItExpiresFirst() {
        LotAvailability expired = lot("EXPIRED", "2026-10-03", 100);
        LotAvailability inDate = lot("OK", "2027-01-31", 100);

        List<LotDraw> draws = selector.allocate(shelf(expired, inDate), 5, null);

        assertEquals("OK", draws.get(0).lot().lotNumber());
    }

    @Test
    void aLotIsStillUsableOnItsPrintedExpiryDate() {
        LotAvailability expiresToday = lot("TODAY", "2026-10-04", 20);

        List<LotDraw> draws = selector.allocate(shelf(expiresToday), 5, null);

        assertEquals("TODAY", draws.get(0).lot().lotNumber());
    }

    @Test
    void prefersOneLotThatCoversTheWholeQuantityOverSpreadingAcrossLots() {
        LotAvailability smallEarly = lot("SMALL", "2026-11-30", 4);
        LotAvailability bigLater = lot("BIG", "2027-03-31", 30);

        List<LotDraw> draws = selector.allocate(shelf(smallEarly, bigLater), 10, null);

        assertEquals(1, draws.size());
        assertEquals("BIG", draws.get(0).lot().lotNumber());
    }

    @Test
    void spreadsAcrossLotsInExpiryOrderWhenNoSingleLotCoversTheQuantity() {
        LotAvailability first = lot("FIRST", "2026-11-30", 4);
        LotAvailability second = lot("SECOND", "2027-03-31", 5);
        LotAvailability third = lot("THIRD", "2027-09-30", 6);

        List<LotDraw> draws = selector.allocate(shelf(third, second, first), 12, null);

        assertEquals(List.of("FIRST", "SECOND", "THIRD"),
                draws.stream().map(draw -> draw.lot().lotNumber()).toList());
        assertEquals(List.of(4, 5, 3), draws.stream().map(LotDraw::quantity).toList());
    }

    @Test
    void lotsWithoutAnExpiryDateComeAfterDatedLots() {
        LotAvailability undated = lot("NO-EXPIRY", null, 100);
        LotAvailability dated = lot("DATED", "2027-01-31", 100);

        List<LotDraw> draws = selector.allocate(shelf(undated, dated), 5, null);

        assertEquals("DATED", draws.get(0).lot().lotNumber());
    }

    @Test
    void refusesWhenUsableStockIsShortAndSaysHowMuchIsUsable() {
        LotAvailability inDate = lot("OK", "2027-01-31", 8);

        InsufficientUsableStockException thrown = assertThrows(InsufficientUsableStockException.class,
                () -> selector.allocate(shelf(inDate), 20, null));

        assertTrue(thrown.getMessage().contains("Only 8 of 20"));
    }

    @Test
    void shortageMessageNamesTheExpiredLotThatWasSetAside() {
        LotAvailability inDate = lot("OK", "2027-01-31", 8);
        LotAvailability expired = lot("OLD-77", "2026-08-15", 30);

        InsufficientUsableStockException thrown = assertThrows(InsufficientUsableStockException.class,
                () -> selector.allocate(shelf(inDate, expired), 20, null));

        assertTrue(thrown.getMessage().contains("OLD-77"));
        assertTrue(thrown.getMessage().contains("15 Aug 2026"));
    }

    @Test
    void refusesAnExplicitlyChosenExpiredLotAndNamesIt() {
        LotAvailability expired = lot("OLD-77", "2026-08-15", 30);
        LotAvailability inDate = lot("OK", "2027-01-31", 30);

        ExpiredLotException thrown = assertThrows(ExpiredLotException.class,
                () -> selector.allocate(shelf(expired, inDate), 5, expired.batchId()));

        assertTrue(thrown.getMessage().contains("OLD-77"));
    }

    @Test
    void honoursAnExplicitlyChosenLotInsteadOfTheFirstExpiring() {
        LotAvailability earlier = lot("EARLY", "2026-12-31", 50);
        LotAvailability chosen = lot("CHOSEN", "2027-06-30", 50);

        List<LotDraw> draws = selector.allocate(shelf(earlier, chosen), 5, chosen.batchId());

        assertEquals("CHOSEN", draws.get(0).lot().lotNumber());
    }

    @Test
    void doesNotTopUpAnExplicitLotFromOtherLots() {
        LotAvailability chosen = lot("CHOSEN", "2027-06-30", 3);
        LotAvailability other = lot("OTHER", "2027-09-30", 50);

        assertThrows(InsufficientUsableStockException.class,
                () -> selector.allocate(shelf(chosen, other), 5, chosen.batchId()));
    }

    @Test
    void refusesAnExplicitLotThatHasNoStockHere() {
        LotAvailability onShelf = lot("OK", "2027-01-31", 30);

        assertThrows(DispensingConflictException.class,
                () -> selector.allocate(shelf(onShelf), 5, UUID.randomUUID()));
    }
}
