package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Optional;

import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.ACTOR;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.FACILITY_ID;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.PRODUCT_ID;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// Destroying or losing scheduled stock must say why; other kinds need not.
class ScheduleRegisterReasonTest {

    private final ScheduledProductLookup scheduledProducts = mock(ScheduledProductLookup.class);
    private final ScheduleRegisterAppender appender = mock(ScheduleRegisterAppender.class);
    private final ScheduleRegisterService service = new ScheduleRegisterService(scheduledProducts,
            mock(WitnessVerifier.class), appender);

    private ScheduleRegisterService.NewEntryCommand entry(RegisterEntryKind kind, String reason) {
        return new ScheduleRegisterService.NewEntryCommand(FACILITY_ID, PRODUCT_ID, kind, 2, null, null, null, null,
                null, "LOT-1", null, null, reason);
    }

    private RegisterEntryDetails appendedDetails() {
        ArgumentCaptor<RegisterEntryDetails> appended = ArgumentCaptor.forClass(RegisterEntryDetails.class);
        verify(appender).append(appended.capture());
        return appended.getValue();
    }

    private void productIsScheduleFive() {
        when(scheduledProducts.scheduleOf(PRODUCT_ID)).thenReturn(Optional.of(DrugSchedule.S5));
    }

    @Test
    void destroyedWithoutAReasonIsRefused() {
        productIsScheduleFive();

        InvalidRegisterEntryException refusal = assertThrows(InvalidRegisterEntryException.class,
                () -> service.record(entry(RegisterEntryKind.DESTROYED, null), ACTOR.id(), ACTOR.name()));

        assertEquals("Say why this medicine was destroyed (at least 3 characters).", refusal.getMessage());
        verify(appender, never()).append(any());
    }

    @Test
    void lostWithATooShortReasonIsRefused() {
        productIsScheduleFive();

        assertThrows(InvalidRegisterEntryException.class,
                () -> service.record(entry(RegisterEntryKind.LOST, " ab "), ACTOR.id(), ACTOR.name()));

        verify(appender, never()).append(any());
    }

    @Test
    void reasonOfThreeCharactersIsAccepted() {
        productIsScheduleFive();

        service.record(entry(RegisterEntryKind.LOST, "Fire"), ACTOR.id(), ACTOR.name());

        assertEquals("Fire", appendedDetails().reason());
    }

    @Test
    void reasonIsTrimmedBeforeItIsStored() {
        productIsScheduleFive();

        service.record(entry(RegisterEntryKind.DESTROYED, "  Expired stock  "), ACTOR.id(), ACTOR.name());

        assertEquals("Expired stock", appendedDetails().reason());
    }

    @Test
    void otherKindsDoNotNeedAReason() {
        productIsScheduleFive();

        service.record(entry(RegisterEntryKind.RECEIVED, null), ACTOR.id(), ACTOR.name());

        assertNull(appendedDetails().reason());
    }

    @Test
    void reasonGivenForAnOtherKindIsStillKept() {
        productIsScheduleFive();

        service.record(entry(RegisterEntryKind.RECEIVED, "Delivery note 4411"), ACTOR.id(), ACTOR.name());

        assertEquals("Delivery note 4411", appendedDetails().reason());
    }
}
