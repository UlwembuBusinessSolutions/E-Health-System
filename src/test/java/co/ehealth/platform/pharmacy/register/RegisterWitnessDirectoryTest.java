package co.ehealth.platform.pharmacy.register;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RegisterWitnessDirectoryTest {

    private final RegisterWitnessRepository witnessRepository = mock(RegisterWitnessRepository.class);
    private final RegisterWitnessDirectory directory = new RegisterWitnessDirectory(witnessRepository);

    private final UUID facilityId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();

    private RegisterWitnessRepository.WitnessRow row(UUID id, String firstName, String lastName) {
        var row = mock(RegisterWitnessRepository.WitnessRow.class);
        when(row.getId()).thenReturn(id);
        when(row.getFirstName()).thenReturn(firstName);
        when(row.getLastName()).thenReturn(lastName);
        return row;
    }

    @Test
    void offersOnlyAnIdAndADisplayNameForEachWitness() {
        UUID lerato = UUID.randomUUID();
        var colleague = row(lerato, "Lerato", "Molefe");
        when(witnessRepository.findPharmacyStaff(facilityId, actorId)).thenReturn(List.of(colleague));

        List<RegisterWitnessDirectory.WitnessOption> options = directory.witnessesFor(facilityId, actorId);

        assertEquals(List.of(new RegisterWitnessDirectory.WitnessOption(lerato, "Lerato Molefe")), options);
    }

    @Test
    void theSignedInUserIsExcludedByTheQuery() {
        directory.witnessesFor(facilityId, actorId);

        verify(witnessRepository).findPharmacyStaff(facilityId, actorId);
    }
}
