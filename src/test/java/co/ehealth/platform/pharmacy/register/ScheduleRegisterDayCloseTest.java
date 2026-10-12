package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.ACTOR;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.CLOCK;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.FACILITY_ID;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.PRODUCT_ID;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.entry;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScheduleRegisterDayCloseTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 4);

    private final ScheduleRegisterEntryRepository entryRepository = mock(ScheduleRegisterEntryRepository.class);
    private final ScheduleDayCloseRepository dayCloseRepository = mock(ScheduleDayCloseRepository.class);
    private final ScheduledProductLookup scheduledProducts = mock(ScheduledProductLookup.class);
    private final FacilityBusinessDay businessDay = mock(FacilityBusinessDay.class);
    private final ScheduleDayCloseService service = new ScheduleDayCloseService(entryRepository, dayCloseRepository,
            mock(RegisterProductLockRepository.class), scheduledProducts, businessDay, CLOCK);

    ScheduleRegisterDayCloseTest() {
        when(businessDay.today(FACILITY_ID)).thenReturn(TODAY);
        when(businessDay.windowOf(FACILITY_ID, TODAY)).thenReturn(new FacilityBusinessDay.Window(
                Instant.parse("2026-10-03T22:00:00Z"), Instant.parse("2026-10-04T22:00:00Z")));
        when(scheduledProducts.scheduleOf(PRODUCT_ID)).thenReturn(Optional.of(DrugSchedule.S5));
        when(dayCloseRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    // Opening 10 (from yesterday), then +5 received, -7 dispensed, -1
    // destroyed, -1 lost, +2 returned: 10 + 5 - 7 - 1 - 1 + 2 = 8 expected.
    private void todayHasTheseMovements() {
        when(entryRepository.findFirstByFacilityIdAndProductIdAndEntryAtLessThanOrderBySeqDesc(eq(FACILITY_ID),
                eq(PRODUCT_ID), any())).thenReturn(Optional.of(entry(RegisterEntryKind.RECEIVED, 10, 10)));
        when(entryRepository
                .findByFacilityIdAndProductIdAndEntryAtGreaterThanEqualAndEntryAtLessThanOrderBySeqAsc(
                        eq(FACILITY_ID), eq(PRODUCT_ID), any(), any()))
                .thenReturn(List.of(entry(RegisterEntryKind.RECEIVED, 5, 15),
                        entry(RegisterEntryKind.DISPENSED, 7, 8), entry(RegisterEntryKind.DESTROYED, 1, 7),
                        entry(RegisterEntryKind.LOST, 1, 6), entry(RegisterEntryKind.RETURNED, 2, 8)));
    }

    private ScheduleDayCloseService.CloseCommand closeWith(long counted, String reason) {
        return new ScheduleDayCloseService.CloseCommand(FACILITY_ID, PRODUCT_ID, TODAY, counted, reason);
    }

    @Test
    void expectedIsOpeningPlusReceivedMinusDispensedDestroyedLostPlusReturned() {
        assertEquals(8L, new DayFigures(10, 5, 7, 1, 1, 2).expected());
    }

    @Test
    void anOpeningEntryMadeTodayCountsAsTheOpeningBalanceNotAMovement() {
        DayFigures figures = DayFigures.of(0, List.of(entry(RegisterEntryKind.OPENING, 20, 20),
                entry(RegisterEntryKind.DISPENSED, 3, 17)));

        assertEquals(20L, figures.opening());
        assertEquals(17L, figures.expected());
    }

    @Test
    void reconciliationCardIsBuiltFromTheDaysEntries() {
        todayHasTheseMovements();
        when(dayCloseRepository.findByFacilityIdAndProductIdAndBusinessDate(FACILITY_ID, PRODUCT_ID, TODAY))
                .thenReturn(Optional.empty());

        ScheduleDayCloseService.Reconciliation card = service.reconciliationFor(FACILITY_ID, PRODUCT_ID, TODAY);

        assertEquals(new DayFigures(10, 5, 7, 1, 1, 2), card.figures());
        assertNull(card.close());
    }

    @Test
    void matchingCountClosesTheDayWithoutAReason() {
        todayHasTheseMovements();

        service.close(closeWith(8, null), ACTOR.id(), ACTOR.name());

        ArgumentCaptor<ScheduleDayClose> saved = ArgumentCaptor.forClass(ScheduleDayClose.class);
        verify(dayCloseRepository).save(saved.capture());
        assertEquals(8L, saved.getValue().getExpected());
        assertEquals(0L, saved.getValue().getVariance());
        assertNull(saved.getValue().getVarianceReason());
    }

    @Test
    void differenceWithoutAReasonIsRefused() {
        todayHasTheseMovements();

        assertThrows(InvalidRegisterEntryException.class, () -> service.close(closeWith(6, null), ACTOR.id(), ACTOR.name()));
        verify(dayCloseRepository, never()).save(any());
    }

    @Test
    void reasonShorterThanFiveCharactersIsRefused() {
        todayHasTheseMovements();

        assertThrows(InvalidRegisterEntryException.class,
                () -> service.close(closeWith(6, "  oops "), ACTOR.id(), ACTOR.name()));
    }

    @Test
    void differenceWithAReasonIsSignedWithTheVarianceRecorded() {
        todayHasTheseMovements();

        service.close(closeWith(6, "Two tablets spilled"), ACTOR.id(), ACTOR.name());

        ArgumentCaptor<ScheduleDayClose> saved = ArgumentCaptor.forClass(ScheduleDayClose.class);
        verify(dayCloseRepository).save(saved.capture());
        assertEquals(-2L, saved.getValue().getVariance());
        assertEquals("Two tablets spilled", saved.getValue().getVarianceReason());
        assertEquals("Thandi Nkosi", saved.getValue().getClosedByName());
    }

    @Test
    void aDayCanOnlyBeClosedOnce() {
        todayHasTheseMovements();
        when(dayCloseRepository.existsByFacilityIdAndProductIdAndBusinessDate(FACILITY_ID, PRODUCT_ID, TODAY))
                .thenReturn(true);

        assertThrows(RegisterDayClosedException.class, () -> service.close(closeWith(8, null), ACTOR.id(), ACTOR.name()));
        verify(dayCloseRepository, never()).save(any());
    }

    @Test
    void aFutureDayCannotBeClosed() {
        ScheduleDayCloseService.CloseCommand tomorrow = new ScheduleDayCloseService.CloseCommand(FACILITY_ID,
                PRODUCT_ID, TODAY.plusDays(1), 8, null);

        assertThrows(InvalidRegisterEntryException.class, () -> service.close(tomorrow, ACTOR.id(), ACTOR.name()));
    }
}
