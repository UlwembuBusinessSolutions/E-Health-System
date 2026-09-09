package co.ehealth.platform.patient;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.clinic.ClinicAccessDeniedException;
import co.ehealth.platform.core.clinic.ClinicContext;
import co.ehealth.platform.identity.PermissionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PatientClinicScopeTest {
    private final UUID clinicA = UUID.randomUUID();
    private final UUID clinicB = UUID.randomUUID();
    private final PatientRepository patients = mock(PatientRepository.class);
    private final PatientService service = new PatientService(patients, mock(AuditLogService.class),
            Clock.systemUTC(), mock(PermissionService.class), new ObjectMapper());

    @AfterEach void cleanup() { ClinicContext.clear(); }

    @Test
    void searchesUseOnlyTheActiveClinicIncludingAfterSwitching() {
        var a = mock(Patient.class);
        var b = mock(Patient.class);
        when(patients.search("Smith", clinicA)).thenReturn(List.of(a));
        when(patients.search("Smith", clinicB)).thenReturn(List.of(b));
        ClinicContext.set(clinicA);
        assertThat(service.search(" Smith ")).containsExactly(a);
        ClinicContext.set(clinicB);
        assertThat(service.search("Smith")).containsExactly(b);
    }

    @Test
    void directLookupAndUpdateCannotAccessAnotherClinic() {
        UUID id = UUID.randomUUID();
        ClinicContext.set(clinicA);
        when(patients.findByIdAndFacilityId(id, clinicA)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.get(id)).isInstanceOf(PatientNotFoundException.class);
        assertThatThrownBy(() -> service.updateDemographics(id, null, UUID.randomUUID()))
                .isInstanceOf(PatientNotFoundException.class);
        verify(patients, never()).findById(any());
    }

    @Test
    void missingContextFailsClosed() {
        assertThatThrownBy(() -> service.search("Smith")).isInstanceOf(ClinicAccessDeniedException.class);
        assertThatThrownBy(() -> service.register(null, UUID.randomUUID()))
                .isInstanceOf(ClinicAccessDeniedException.class);
        verifyNoInteractions(patients);
    }

    @Test
    void newPatientBelongsToActiveClinic() {
        ClinicContext.set(clinicB);
        when(patients.nextMpiSequenceValue()).thenReturn(1L);
        when(patients.save(any())).thenAnswer(invocation -> {
            Patient p = invocation.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(p, "id", UUID.randomUUID());
            return p;
        });
        Patient patient = service.register(new PatientService.RegisterPatientCommand("Andile", "Ngcobo",
                "8501011002085", "12 Main Road", "+27821234567", null, null), UUID.randomUUID());
        assertThat(patient.getFacilityId()).isEqualTo(clinicB);
    }
}
