package co.ehealth.platform.pharmacy.register;

import co.ehealth.platform.pharmacy.stock.DrugSchedule;
import co.ehealth.platform.identity.User;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.identity.UserStatus;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.ACTOR;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.FACILITY_ID;
import static co.ehealth.platform.pharmacy.register.RegisterTestFixtures.PRODUCT_ID;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ScheduleRegisterWitnessTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final ScheduledProductLookup scheduledProducts = mock(ScheduledProductLookup.class);
    private final ScheduleRegisterAppender appender = mock(ScheduleRegisterAppender.class);
    private final ScheduleRegisterService service = new ScheduleRegisterService(scheduledProducts,
            new WitnessVerifier(userRepository, passwordEncoder), appender);

    private final UUID witnessId = UUID.randomUUID();

    private ScheduleRegisterService.NewEntryCommand command(UUID witnessStaffId, String witnessPin) {
        return new ScheduleRegisterService.NewEntryCommand(FACILITY_ID, PRODUCT_ID, RegisterEntryKind.DESTROYED, 2,
                null, null, null, null, null, "LOT-1", witnessStaffId, witnessPin, "Expired stock");
    }

    private void productIs(DrugSchedule schedule) {
        when(scheduledProducts.scheduleOf(PRODUCT_ID)).thenReturn(Optional.of(schedule));
    }

    private void witnessAccountExists(String password, boolean passwordMatches) {
        User witness = mock(User.class);
        when(witness.getId()).thenReturn(witnessId);
        when(witness.getFirstName()).thenReturn("Lerato");
        when(witness.getLastName()).thenReturn("Molefe");
        when(witness.getStatus()).thenReturn(UserStatus.ACTIVE);
        when(witness.getPasswordHash()).thenReturn("hash");
        when(userRepository.findById(witnessId)).thenReturn(Optional.of(witness));
        when(passwordEncoder.matches(password, "hash")).thenReturn(passwordMatches);
    }

    private ScheduleRegisterService.NewEntryCommand witnessedByColleague() {
        return command(witnessId, "correct-password");
    }

    @Test
    void scheduleSixWithoutAWitnessIsRefused() {
        productIs(DrugSchedule.S6);

        assertThrows(InvalidWitnessException.class, () -> service.record(command(null, null), ACTOR.id(), ACTOR.name()));

        verify(appender, never()).append(any());
    }

    @Test
    void witnessMustBeADifferentStaffMemberFromTheActor() {
        productIs(DrugSchedule.S6);

        InvalidWitnessException refusal = assertThrows(InvalidWitnessException.class,
                () -> service.record(command(ACTOR.id(), "my-own-password"), ACTOR.id(), ACTOR.name()));

        assertEquals("The witness must be a different staff member from you.", refusal.getMessage());
        verify(appender, never()).append(any());
        verify(userRepository, never()).findById(any());
    }

    @Test
    void wrongWitnessPasswordIsRefused() {
        productIs(DrugSchedule.S6);
        witnessAccountExists("correct-password", false);

        assertThrows(InvalidWitnessException.class,
                () -> service.record(witnessedByColleague(), ACTOR.id(), ACTOR.name()));

        verify(appender, never()).append(any());
    }

    @Test
    void confirmedWitnessIsRecordedOnTheEntry() {
        productIs(DrugSchedule.S6);
        witnessAccountExists("correct-password", true);

        service.record(witnessedByColleague(), ACTOR.id(), ACTOR.name());

        ArgumentCaptor<RegisterEntryDetails> appended = ArgumentCaptor.forClass(RegisterEntryDetails.class);
        verify(appender).append(appended.capture());
        assertEquals(new RegisterStaff(witnessId, "Lerato Molefe"), appended.getValue().witness());
        assertEquals(ACTOR, appended.getValue().actor());
    }

    @Test
    void scheduleFiveNeedsNoWitness() {
        productIs(DrugSchedule.S5);

        service.record(command(null, null), ACTOR.id(), ACTOR.name());

        ArgumentCaptor<RegisterEntryDetails> appended = ArgumentCaptor.forClass(RegisterEntryDetails.class);
        verify(appender).append(appended.capture());
        assertNull(appended.getValue().witness());
    }

    @Test
    void unscheduledProductDoesNotBelongInTheRegister() {
        when(scheduledProducts.scheduleOf(PRODUCT_ID)).thenReturn(Optional.empty());

        assertThrows(InvalidRegisterEntryException.class,
                () -> service.record(command(null, null), ACTOR.id(), ACTOR.name()));
    }
}
