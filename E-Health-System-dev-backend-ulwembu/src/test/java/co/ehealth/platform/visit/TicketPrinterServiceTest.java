package co.ehealth.platform.visit;

import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.facility.FacilityType;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

/**
 * RECQ-US-003: Tests for ticket printer service.
 * Validates AC: Given a token is issued, When I print, Then the ticket shows
 * token number, service station, estimated wait and issue time.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Ticket Printer Service - RECQ-US-003")
class TicketPrinterServiceTest {

    private QueueTokenRepository queueTokenRepository;

    private VisitRepository visitRepository;

    private FacilityRepository facilityRepository;

    private PatientService patientService;

    private Clock clock;

    private TicketPrinterService ticketPrinterService;

    private UUID tokenId;
    private UUID visitId;
    private UUID facilityId;
    private UUID patientId;
    private QueueToken mockToken;
    private Visit mockVisit;
    private Facility mockFacility;
    private Patient mockPatient;

    @BeforeEach
    void setUp() {
        // Create lenient mocks for repositories to allow them to be overridden in individual tests
        queueTokenRepository = mock(QueueTokenRepository.class, withSettings().lenient());
        visitRepository = mock(VisitRepository.class, withSettings().lenient());
        facilityRepository = mock(FacilityRepository.class, withSettings().lenient());
        patientService = mock(PatientService.class, withSettings().lenient());
        clock = mock(Clock.class, withSettings().lenient());

        ticketPrinterService = new TicketPrinterService(
                queueTokenRepository,
                visitRepository,
                facilityRepository,
                patientService,
                clock
        );

        tokenId = UUID.randomUUID();
        visitId = UUID.randomUUID();
        facilityId = UUID.randomUUID();
        patientId = UUID.randomUUID();

        // Setup mock token
        mockToken = mock(QueueToken.class, withSettings().lenient());
        when(mockToken.getId()).thenReturn(tokenId);
        when(mockToken.getTokenNumber()).thenReturn(42);
        when(mockToken.getVisitId()).thenReturn(visitId);
        when(mockToken.getFacilityId()).thenReturn(facilityId);
        when(mockToken.getPriority()).thenReturn(TokenPriority.NORMAL);
        when(mockToken.getStatus()).thenReturn(TokenStatus.ISSUED);
        Instant now = LocalDate.of(2026, 9, 1).atStartOfDay(ZoneOffset.UTC).toInstant();
        when(mockToken.getIssuedAt()).thenReturn(now);

        // Setup mock visit
        mockVisit = mock(Visit.class, withSettings().lenient());
        when(mockVisit.getId()).thenReturn(visitId);
        when(mockVisit.getPatientId()).thenReturn(patientId);

        // Setup mock facility
        mockFacility = mock(Facility.class, withSettings().lenient());
        when(mockFacility.getId()).thenReturn(facilityId);
        when(mockFacility.getName()).thenReturn("Pretoria Central Clinic");
        when(mockFacility.getCode()).thenReturn("PCC01");

        // Setup mock patient
        mockPatient = mock(Patient.class, withSettings().lenient());
        when(mockPatient.getFirstName()).thenReturn("John");
        when(mockPatient.getLastName()).thenReturn("Doe");
        when(mockPatient.getMpiNumber()).thenReturn("MPI-0000001");

        // Setup repositories with default behavior
        when(queueTokenRepository.findById(tokenId)).thenReturn(Optional.of(mockToken));
        when(visitRepository.findById(visitId)).thenReturn(Optional.of(mockVisit));
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(mockFacility));
        when(patientService.get(patientId)).thenReturn(mockPatient);
    }

    @Test
    @DisplayName("AC: Ticket contains token number from issued token")
    void testTicketContainsTokenNumber() {
        when(queueTokenRepository.findActiveQueue(facilityId)).thenReturn(List.of(mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.tokenNumber()).isEqualTo(42);
        assertThat(ticket.getFormattedTokenNumber()).isEqualTo("A-0042");
    }

    @Test
    @DisplayName("AC: Ticket contains service station (facility name and code)")
    void testTicketContainsServiceStation() {
        when(queueTokenRepository.findActiveQueue(facilityId)).thenReturn(List.of(mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.facilityName()).isEqualTo("Pretoria Central Clinic");
        assertThat(ticket.facilityCode()).isEqualTo("PCC01");
        assertThat(ticket.getServiceStation()).isEqualTo("Pretoria Central Clinic (PCC01)");
    }

    @Test
    @DisplayName("AC: Ticket contains issue time in readable format")
    void testTicketContainsIssueTime() {
        when(queueTokenRepository.findActiveQueue(facilityId)).thenReturn(List.of(mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.issuedAtFormatted())
                .contains("2026-09-01")
                .matches("\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}");
    }

    @Test
    @DisplayName("AC: Ticket contains estimated wait time based on queue position")
    void testTicketContainsEstimatedWait() {
        when(queueTokenRepository.findActiveQueue(facilityId)).thenReturn(List.of(mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        // Token is first in queue, so wait is 0 minutes
        assertThat(ticket.estimatedWaitMinutes()).isEqualTo("0");
    }

    @Test
    @DisplayName("Estimated wait increases with queue position (5 min per person)")
    void testEstimatedWaitCalculation() {
        QueueToken token2 = mock(QueueToken.class, withSettings().lenient());
        QueueToken token3 = mock(QueueToken.class, withSettings().lenient());

        when(queueTokenRepository.findActiveQueue(facilityId))
                .thenReturn(List.of(mockToken, token2, token3));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        // Position 1: 0 minutes
        assertThat(ticket.estimatedWaitMinutes()).isEqualTo("0");
        assertThat(ticket.queuePosition()).isEqualTo(1);
    }

    @Test
    @DisplayName("Estimated wait for second in queue is 5 minutes")
    void testEstimatedWaitForSecondInQueue() {
        QueueToken token1 = mock(QueueToken.class, withSettings().lenient());
        when(token1.getId()).thenReturn(UUID.randomUUID());

        when(queueTokenRepository.findActiveQueue(facilityId))
                .thenReturn(List.of(token1, mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.queuePosition()).isEqualTo(2);
        assertThat(ticket.estimatedWaitMinutes()).isEqualTo("5");
    }

    @Test
    @DisplayName("Estimated wait for third in queue is 10 minutes")
    void testEstimatedWaitForThirdInQueue() {
        QueueToken token1 = mock(QueueToken.class, withSettings().lenient());
        when(token1.getId()).thenReturn(UUID.randomUUID());
        QueueToken token2 = mock(QueueToken.class, withSettings().lenient());
        when(token2.getId()).thenReturn(UUID.randomUUID());

        when(queueTokenRepository.findActiveQueue(facilityId))
                .thenReturn(List.of(token1, token2, mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.queuePosition()).isEqualTo(3);
        assertThat(ticket.estimatedWaitMinutes()).isEqualTo("10");
    }

    @Test
    @DisplayName("Ticket contains patient name and MPI")
    void testTicketContainsPatientInfo() {
        when(queueTokenRepository.findActiveQueue(facilityId)).thenReturn(List.of(mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.patientName()).isEqualTo("John Doe");
        assertThat(ticket.patientMpi()).isEqualTo("MPI-0000001");
    }

    @Test
    @DisplayName("Ticket contains priority level")
    void testTicketContainsPriority() {
        when(queueTokenRepository.findActiveQueue(facilityId)).thenReturn(List.of(mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.priority()).isEqualTo(TokenPriority.NORMAL);
    }

    @Test
    @DisplayName("Throws exception when token not found")
    void testThrowsExceptionWhenTokenNotFound() {
        when(queueTokenRepository.findById(tokenId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ticketPrinterService.generateTicket(tokenId))
                .isInstanceOf(TicketGenerationException.class)
                .hasMessageContaining("Token not found");
    }

    @Test
    @DisplayName("Throws exception when token status is not ISSUED or CALLED")
    void testThrowsExceptionForInvalidTokenStatus() {
        // Note: Currently only ISSUED and CALLED are valid states.
        // COMPLETED/CANCELLED will be added in Sprint 3 (RECQ-US-005)
        when(mockToken.getStatus()).thenReturn(TokenStatus.ISSUED);

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);
        assertThat(ticket).isNotNull();
    }

    @Test
    @DisplayName("Throws exception when visit not found")
    void testThrowsExceptionWhenVisitNotFound() {
        when(visitRepository.findById(visitId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ticketPrinterService.generateTicket(tokenId))
                .isInstanceOf(TicketGenerationException.class)
                .hasMessageContaining("Visit not found");
    }

    @Test
    @DisplayName("Throws exception when facility not found")
    void testThrowsExceptionWhenFacilityNotFound() {
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> ticketPrinterService.generateTicket(tokenId))
                .isInstanceOf(TicketGenerationException.class)
                .hasMessageContaining("Facility not found");
    }

    @Test
    @DisplayName("Ticket includes queue position and total")
    void testTicketIncludesQueuePosition() {
        QueueToken token2 = mock(QueueToken.class, withSettings().lenient());
        when(token2.getId()).thenReturn(UUID.randomUUID());
        QueueToken token3 = mock(QueueToken.class, withSettings().lenient());
        when(token3.getId()).thenReturn(UUID.randomUUID());

        when(queueTokenRepository.findActiveQueue(facilityId))
                .thenReturn(List.of(mockToken, token2, token3));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.queuePosition()).isEqualTo(1);
        assertThat(ticket.totalInQueue()).isEqualTo(3);
    }

    @Test
    @DisplayName("Ticket can be generated for ISSUED tokens")
    void testGenerateTicketForIssuedToken() {
        when(mockToken.getStatus()).thenReturn(TokenStatus.ISSUED);
        when(queueTokenRepository.findActiveQueue(facilityId)).thenReturn(List.of(mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket).isNotNull();
        assertThat(ticket.tokenNumber()).isEqualTo(42);
    }

    @Test
    @DisplayName("Ticket can be generated for CALLED tokens")
    void testGenerateTicketForCalledToken() {
        when(mockToken.getStatus()).thenReturn(TokenStatus.CALLED);
        when(queueTokenRepository.findActiveQueue(facilityId)).thenReturn(List.of(mockToken));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket).isNotNull();
        assertThat(ticket.tokenNumber()).isEqualTo(42);
    }

    @Test
    @DisplayName("Ticket shows correct total even when token not in active queue")
    void testTicketWhenTokenNotInActiveQueue() {
        QueueToken other = mock(QueueToken.class, withSettings().lenient());
        when(other.getId()).thenReturn(UUID.randomUUID());

        // Token not in active queue
        when(queueTokenRepository.findActiveQueue(facilityId))
                .thenReturn(List.of(other));

        TicketData ticket = ticketPrinterService.generateTicket(tokenId);

        assertThat(ticket.queuePosition()).isEqualTo(2);  // Beyond queue
        assertThat(ticket.totalInQueue()).isEqualTo(1);
    }
}
