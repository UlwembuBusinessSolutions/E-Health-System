package co.ehealth.platform.visit;

import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.facility.FacilityType;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientRepository;
import co.ehealth.platform.patient.PatientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * RECQ-US-003: Integration tests for ticket printing endpoints.
 * Validates HTTP responses and ticket content through the REST API.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(locations = "classpath:application-test.yml")
@DisplayName("Ticket Printing Integration - RECQ-US-003")
class TicketPrintingIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private QueueTokenRepository queueTokenRepository;

    @Autowired
    private VisitRepository visitRepository;

    @Autowired
    private FacilityRepository facilityRepository;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private PatientService patientService;

    private Facility testFacility;
    private Patient testPatient;
    private Visit testVisit;
    private QueueToken testToken;

    @BeforeEach
    void setUp() {
        // Clean up repositories
        queueTokenRepository.deleteAll();
        visitRepository.deleteAll();
        patientRepository.deleteAll();
        facilityRepository.deleteAll();

        // Create test facility
        testFacility = new Facility();
        testFacility.setId(UUID.randomUUID());
        testFacility.setName("Central Clinic");
        testFacility.setCode("CC01");
        testFacility.setType(FacilityType.CLINIC);
        testFacility.setAddress("123 Main St");
        testFacility.setPhone("555-1234");
        testFacility.setActive(true);
        testFacility = facilityRepository.save(testFacility);

        // Create test patient
        testPatient = new Patient();
        testPatient.setId(UUID.randomUUID());
        testPatient.setMpiNumber("MPI-0000001");
        testPatient.setFirstName("Alice");
        testPatient.setLastName("Smith");
        testPatient = patientRepository.save(testPatient);

        // Create test visit
        testVisit = new Visit();
        testVisit.setId(UUID.randomUUID());
        testVisit.setPatientId(testPatient.getId());
        testVisit.setFacilityId(testFacility.getId());
        testVisit = visitRepository.save(testVisit);

        // Create test token
        Instant now = LocalDate.of(2026, 9, 1).atStartOfDay(ZoneOffset.UTC).toInstant();
        testToken = new QueueToken();
        testToken.setId(UUID.randomUUID());
        testToken.setVisitId(testVisit.getId());
        testToken.setFacilityId(testFacility.getId());
        testToken.setTokenNumber(42);
        testToken.setPriority(TokenPriority.NORMAL);
        testToken.setStatus(TokenStatus.ISSUED);
        testToken.setIssuedAt(now);
        testToken.setIsManual(false);
        testToken = queueTokenRepository.save(testToken);
    }

    @Test
    @DisplayName("GET /api/v1/queue/tokens/{tokenId}/print returns 200 with HTML content")
    @WithMockUser(roles = "Queue Marshall")
    void testPrintTicketReturnsHtmlContent() throws Exception {
        MvcResult result = mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/print", testToken.getId())
                        .accept(MediaType.TEXT_HTML))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.TEXT_HTML))
                .andReturn();

        String response = result.getResponse().getContentAsString();
        assertThat(response)
                .contains("<!DOCTYPE html>")
                .contains("QUEUE TICKET")
                .contains("A-0042")  // Token number
                .contains("Central Clinic")  // Facility name
                .contains("Alice Smith")  // Patient name
                .contains("MPI-0000001");  // Patient MPI
    }

    @Test
    @DisplayName("GET /api/v1/queue/tokens/{tokenId}/print?format=text returns plain text")
    @WithMockUser(roles = "Queue Marshall")
    void testPrintTicketPlainTextFormat() throws Exception {
        MvcResult result = mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/print", testToken.getId())
                        .param("format", "text")
                        .accept(MediaType.TEXT_PLAIN))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.TEXT_PLAIN))
                .andReturn();

        String response = result.getResponse().getContentAsString();
        assertThat(response)
                .contains("QUEUE TICKET")
                .contains("A-0042")
                .contains("Alice Smith")
                .contains("MPI-0000001");
    }

    @Test
    @DisplayName("GET /api/v1/queue/tokens/{tokenId}/ticket-data returns JSON with all fields")
    @WithMockUser(roles = "Queue Marshall")
    void testGetTicketDataReturnsJson() throws Exception {
        MvcResult result = mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/ticket-data", testToken.getId())
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andReturn();

        String response = result.getResponse().getContentAsString();
        assertThat(response)
                .contains("\"tokenNumber\":42")
                .contains("\"facilityName\":\"Central Clinic\"")
                .contains("\"facilityCode\":\"CC01\"")
                .contains("\"patientName\":\"Alice Smith\"")
                .contains("\"patientMpi\":\"MPI-0000001\"")
                .contains("\"priority\":\"NORMAL\"");
    }

    @Test
    @DisplayName("Print endpoint returns 404 when token not found")
    @WithMockUser(roles = "Queue Marshall")
    void testPrintTicketNotFound() throws Exception {
        UUID nonExistentTokenId = UUID.randomUUID();

        mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/print", nonExistentTokenId))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Ticket data includes correct queue position")
    @WithMockUser(roles = "Queue Marshall")
    void testTicketDataIncludesQueuePosition() throws Exception {
        // Create another token to be first in queue
        QueueToken firstToken = new QueueToken();
        firstToken.setId(UUID.randomUUID());
        firstToken.setVisitId(testVisit.getId());
        firstToken.setFacilityId(testFacility.getId());
        firstToken.setTokenNumber(41);
        firstToken.setPriority(TokenPriority.NORMAL);
        firstToken.setStatus(TokenStatus.ISSUED);
        firstToken.setIssuedAt(testToken.getIssuedAt().minusSeconds(300));
        firstToken.setIsManual(false);
        queueTokenRepository.save(firstToken);

        MvcResult result = mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/ticket-data", testToken.getId()))
                .andExpect(status().isOk())
                .andReturn();

        String response = result.getResponse().getContentAsString();
        // testToken should be second in queue
        assertThat(response)
                .contains("\"queuePosition\":2");
    }

    @Test
    @DisplayName("Ticket shows estimated wait based on queue position")
    @WithMockUser(roles = "Queue Marshall")
    void testTicketEstimatedWait() throws Exception {
        MvcResult result = mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/ticket-data", testToken.getId()))
                .andExpect(status().isOk())
                .andReturn();

        String response = result.getResponse().getContentAsString();
        // First in queue should have 0 minutes wait
        assertThat(response)
                .contains("\"estimatedWaitMinutes\":\"0\"");
    }

    @Test
    @DisplayName("Ticket includes issue time in expected format")
    @WithMockUser(roles = "Queue Marshall")
    void testTicketIncludesIssueTime() throws Exception {
        MvcResult result = mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/print", testToken.getId()))
                .andExpect(status().isOk())
                .andReturn();

        String response = result.getResponse().getContentAsString();
        // Should include date and time
        assertThat(response)
                .containsPattern("2026-09-01 \\d{2}:\\d{2}:\\d{2}");
    }

    @Test
    @DisplayName("Print ticket for CALLED token succeeds")
    @WithMockUser(roles = "Queue Marshall")
    void testPrintCalledToken() throws Exception {
        testToken.setStatus(TokenStatus.CALLED);
        queueTokenRepository.save(testToken);

        mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/print", testToken.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.TEXT_HTML));
    }

    @Test
    @DisplayName("Default format is HTML when not specified")
    @WithMockUser(roles = "Queue Marshall")
    void testDefaultFormatIsHtml() throws Exception {
        MvcResult result = mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/print", testToken.getId()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.TEXT_HTML))
                .andReturn();

        String response = result.getResponse().getContentAsString();
        assertThat(response)
                .contains("<!DOCTYPE html>");
    }

    @Test
    @DisplayName("Plaintext format includes patient name")
    @WithMockUser(roles = "Queue Marshall")
    void testPlaintextIncludesPatientName() throws Exception {
        MvcResult result = mockMvc.perform(
                get("/api/v1/queue/tokens/{tokenId}/print", testToken.getId())
                        .param("format", "text"))
                .andExpect(status().isOk())
                .andReturn();

        String response = result.getResponse().getContentAsString();
        assertThat(response)
                .contains("Patient: John Doe");
    }
}
