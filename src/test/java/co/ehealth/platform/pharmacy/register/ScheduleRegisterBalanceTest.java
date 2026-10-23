package co.ehealth.platform.pharmacy.register;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Optional;

import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.CLOCK;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.FACILITY_ID;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.PRODUCT_ID;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.details;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.entry;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScheduleRegisterBalanceTest {

    private final ScheduleRegisterEntryRepository entryRepository = mock(ScheduleRegisterEntryRepository.class);
    private final ScheduleDayCloseRepository dayCloseRepository = mock(ScheduleDayCloseRepository.class);
    private final FacilityBusinessDay businessDay = mock(FacilityBusinessDay.class);
    private final ScheduleRegisterAppender appender = new ScheduleRegisterAppender(entryRepository,
            dayCloseRepository, mock(RegisterProductLockRepository.class), businessDay, CLOCK);

    ScheduleRegisterBalanceTest() {
        when(businessDay.today(FACILITY_ID)).thenReturn(LocalDate.of(2026, 10, 4));
        when(entryRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    private void registerHolds(long balance) {
        when(entryRepository.findFirstByFacilityIdAndProductIdOrderBySeqDesc(FACILITY_ID, PRODUCT_ID))
                .thenReturn(Optional.of(entry(RegisterEntryKind.RECEIVED, balance, balance)));
    }

    @Test
    void takingMoreThanTheBalanceIsRefusedAndNothingIsWritten() {
        registerHolds(5);

        assertThrows(RegisterBalanceExceededException.class,
                () -> appender.append(details(RegisterEntryKind.DISPENSED, 6, null)));

        verify(entryRepository, never()).save(any());
    }

    @Test
    void takingExactlyTheBalanceLeavesZero() {
        registerHolds(5);

        ScheduleRegisterEntry saved = appender.append(details(RegisterEntryKind.DESTROYED, 5, null));

        assertEquals(0L, saved.getBalanceAfter());
        assertEquals(5L, saved.getQuantityOut());
        assertEquals(0L, saved.getQuantityIn());
    }

    @Test
    void receivingAddsToTheRunningBalance() {
        registerHolds(5);

        ScheduleRegisterEntry saved = appender.append(details(RegisterEntryKind.RECEIVED, 10, null));

        assertEquals(15L, saved.getBalanceAfter());
        assertEquals(10L, saved.getQuantityIn());
    }

    @Test
    void emptyRegisterStartsAtZero() {
        when(entryRepository.findFirstByFacilityIdAndProductIdOrderBySeqDesc(FACILITY_ID, PRODUCT_ID))
                .thenReturn(Optional.empty());

        assertThrows(RegisterBalanceExceededException.class,
                () -> appender.append(details(RegisterEntryKind.LOST, 1, null)));
    }

    @Test
    void openingBalanceIsOnlyAllowedBeforeAnyOtherEntry() {
        when(entryRepository.existsByFacilityIdAndProductId(FACILITY_ID, PRODUCT_ID)).thenReturn(true);

        assertThrows(InvalidRegisterEntryException.class,
                () -> appender.append(details(RegisterEntryKind.OPENING, 20, null)));
    }

    @Test
    void quantityMustBePositive() {
        assertThrows(InvalidRegisterEntryException.class,
                () -> appender.append(details(RegisterEntryKind.RECEIVED, 0, null)));
    }

    @Test
    void nothingCanBeAddedOnceTodayHasBeenSignedOff() {
        when(dayCloseRepository.existsByFacilityIdAndProductIdAndBusinessDate(FACILITY_ID, PRODUCT_ID,
                LocalDate.of(2026, 10, 4))).thenReturn(true);

        assertThrows(RegisterDayClosedException.class,
                () -> appender.append(details(RegisterEntryKind.RECEIVED, 10, null)));
        verify(entryRepository, never()).save(any());
    }
}
