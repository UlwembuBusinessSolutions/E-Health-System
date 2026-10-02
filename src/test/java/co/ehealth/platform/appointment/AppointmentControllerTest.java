package co.ehealth.platform.appointment;

import co.ehealth.platform.core.common.GlobalExceptionHandler;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.UUID;
import java.time.LocalDate;
import java.time.LocalTime;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AppointmentControllerTest {
    private final AppointmentService service = mock(AppointmentService.class);
    private final UUID facility = UUID.randomUUID(), actor = UUID.randomUUID();
    private MockMvc mvc;
    @BeforeEach void setup() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(actor, "test"), null));
        mvc = MockMvcBuilders.standaloneSetup(new AppointmentController(service))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new AppointmentExceptionHandler(), new GlobalExceptionHandler()).build();
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    @Test void invalidSettingsAreRejectedWithoutWriting() throws Exception {
        for (String json : new String[]{"{}", "{\"unlimited\":false}", "{\"unlimited\":false,\"dailyLimit\":0}",
                "{\"unlimited\":false,\"dailyLimit\":-1}", "{\"unlimited\":false,\"dailyLimit\":1.5}",
                "{\"unlimited\":false,\"dailyLimit\":2147483648}", "{\"unlimited\":true,\"dailyLimit\":10}"}) {
            mvc.perform(patch("/api/v1/admin/appointment-settings/" + facility).contentType(MediaType.APPLICATION_JSON).content(json))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void validLimitsAndExplicitUnlimitedAreAccepted() throws Exception {
        mvc.perform(patch("/api/v1/admin/appointment-settings/" + facility).contentType(MediaType.APPLICATION_JSON)
                .content("{\"unlimited\":false,\"dailyLimit\":50}")).andExpect(status().isOk());
        verify(service).updateLimit(facility, 50, actor);
        mvc.perform(patch("/api/v1/admin/appointment-settings/" + facility).contentType(MediaType.APPLICATION_JSON)
                .content("{\"unlimited\":true,\"dailyLimit\":null}")).andExpect(status().isOk());
        verify(service).updateLimit(facility, null, actor);
    }
    @Test void capacityConflictHasActionableApiMessage() throws Exception {
        when(service.book(any(), any(), any(), any(), any(), nullable(UUID.class), nullable(String.class), any())).thenThrow(new AppointmentException(409, "Daily appointment limit reached (50 of 50). Choose another date."));
        mvc.perform(post("/api/v1/facilities/" + facility + "/appointments").contentType(MediaType.APPLICATION_JSON)
                .content("{\"requestId\":\"" + UUID.randomUUID() + "\",\"patientId\":\"" + UUID.randomUUID() + "\",\"date\":\"2030-01-10\",\"time\":\"09:00\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Daily appointment limit reached (50 of 50). Choose another date."));
    }

    @Test void bookingAcceptsDateTimeClinicianAndNotesAndRejectsOversizedNotes() throws Exception {
        UUID request = UUID.randomUUID(), patient = UUID.randomUUID(), clinician = UUID.randomUUID();
        String prefix = "{\"requestId\":\"" + request + "\",\"patientId\":\"" + patient
                + "\",\"date\":\"2030-01-10\",\"time\":\"09:30\",\"assignedStaffId\":\"" + clinician + "\",\"notes\":\"";
        mvc.perform(post("/api/v1/facilities/" + facility + "/appointments").contentType(MediaType.APPLICATION_JSON)
                .content(prefix + "Bring referral\"}")).andExpect(status().isCreated());
        verify(service).book(facility, request, patient, LocalDate.of(2030, 1, 10), LocalTime.of(9, 30), clinician, "Bring referral", actor);
        clearInvocations(service);
        mvc.perform(post("/api/v1/facilities/" + facility + "/appointments").contentType(MediaType.APPLICATION_JSON)
                .content(prefix + "x".repeat(1001) + "\"}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/facilities/" + facility + "/appointments/" + request + "/reschedule").contentType(MediaType.APPLICATION_JSON)
                .content("{\"date\":\"2030-01-10\",\"time\":\"09:30\",\"version\":0,\"notes\":\"" + "x".repeat(1001) + "\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
