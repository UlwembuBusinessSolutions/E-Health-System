package co.ehealth.platform.facility;

import co.ehealth.platform.identity.DuplicateFieldException;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FacilityServiceTest {
    private final FacilityRepository repository = mock(FacilityRepository.class);
    private final FacilityService service = new FacilityService(repository);

    @Test void updatesExistingFacilityAndClearsOptionalDetails() {
        UUID id = UUID.randomUUID();
        Facility facility = new Facility("Original", "CL-1", FacilityType.CLINIC);
        facility.setAddress("Old address");
        when(repository.findById(id)).thenReturn(Optional.of(facility));
        when(repository.save(facility)).thenReturn(facility);
        assertSame(facility, service.update(id, "Updated", "CL-1", FacilityType.HOSPITAL, "", "01234", "Weekdays"));
        assertEquals("Updated", facility.getName());
        assertEquals("", facility.getAddress());
        assertEquals(FacilityType.HOSPITAL, facility.getType());
        assertTrue(facility.isActive());
        verify(repository).existsByCodeAndIdNot("CL-1", id);
    }

    @Test void rejectsAnotherFacilityCodeWithoutChangingExistingDetails() {
        UUID id = UUID.randomUUID();
        Facility facility = new Facility("Original", "CL-1", FacilityType.CLINIC);
        when(repository.findById(id)).thenReturn(Optional.of(facility));
        when(repository.existsByCodeAndIdNot("CL-2", id)).thenReturn(true);
        assertThrows(DuplicateFieldException.class, () -> service.update(id, "Changed", "CL-2", FacilityType.CLINIC, null, null, null));
        assertEquals("Original", facility.getName());
        verify(repository, never()).save(any());
    }

    @Test void missingFacilityCannotBeUpdated() {
        UUID id = UUID.randomUUID();
        when(repository.findById(id)).thenReturn(Optional.empty());
        assertThrows(FacilityNotFoundException.class, () -> service.update(id, "Name", "CL-1", FacilityType.CLINIC, null, null, null));
        verify(repository, never()).save(any());
    }
}
