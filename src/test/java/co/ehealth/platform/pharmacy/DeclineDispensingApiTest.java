package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.common.GlobalExceptionHandler;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.patient.PatientService;
import org.junit.jupiter.api.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class DeclineDispensingApiTest {
    PrescriptionService prescriptions = mock(PrescriptionService.class);
    PrescriptionSafetyService safety = mock(PrescriptionSafetyService.class);
    UUID prescriptionId = UUID.randomUUID(), itemId = UUID.randomUUID(), actor = UUID.randomUUID();
    String path = "/api/v1/prescriptions/" + prescriptionId + "/items/" + itemId;
    MockMvc mvc;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new PrescriptionController(prescriptions, mock(PatientService.class), mock(UserRepository.class), safety))
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .setMessageConverters(new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(
                        org.springframework.http.converter.json.Jackson2ObjectMapperBuilder.json()
                                .featuresToDisable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build()))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(new AuthenticatedPrincipal(actor, "test"), "", List.of()));
    }
    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }
    @Test void missingAndUnknownReasonAreBadRequests() throws Exception {
        mvc.perform(post(path + "/decline").contentType("application/json").content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(path + "/decline").contentType("application/json").content("{\"reasonCode\":\"UNSUPPORTED\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(safety);
    }
    @Test void validDeclineUsesAuthenticatedActor() throws Exception {
        mvc.perform(post(path + "/decline").contentType("application/json")
                .content("{\"reasonCode\":\"SUFFICIENT_MEDICATION\",\"note\":\"Supply at home\"}"))
                .andExpect(status().isNoContent());
        verify(safety).decline(prescriptionId, itemId, actor, DeclineReason.SUFFICIENT_MEDICATION, "Supply at home");
    }
    @Test void missingCoverageDateIsBadRequest() throws Exception {
        mvc.perform(post(path + "/dispense").contentType("application/json")
                .content("{\"productId\":\"" + UUID.randomUUID() + "\",\"batchId\":\"" + UUID.randomUUID()
                        + "\",\"locationId\":\"" + UUID.randomUUID() + "\",\"quantity\":7}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(prescriptions);
    }
    @Test void dispensingConflictContainsPriorDateAndClinic() throws Exception {
        var warning = new PrescriptionSafetyService.SupplyWarning(UUID.randomUUID(), UUID.randomUUID(),
                Instant.parse("2026-09-30T10:00:00Z"), UUID.randomUUID(), "Other clinic", LocalDate.of(2026, 10, 9), 7);
        doThrow(new DuplicateSupplyException(List.of(warning))).when(prescriptions).dispenseItem(eq(prescriptionId), eq(itemId), eq(actor), any());
        mvc.perform(post(path + "/dispense").contentType("application/json")
                .content("{\"productId\":\"" + UUID.randomUUID() + "\",\"batchId\":\"" + UUID.randomUUID()
                        + "\",\"locationId\":\"" + UUID.randomUUID() + "\",\"quantity\":7,\"supplyUntil\":\"2026-10-09\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_DISPENSING"))
                .andExpect(jsonPath("$.warnings[0].facilityName").value("Other clinic"))
                .andExpect(jsonPath("$.warnings[0].dispensedAt").value("2026-09-30T10:00:00Z"));
    }
}
