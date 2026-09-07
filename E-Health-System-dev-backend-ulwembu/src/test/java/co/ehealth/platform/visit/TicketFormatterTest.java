package co.ehealth.platform.visit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * RECQ-US-003: Tests for ticket formatting.
 * Validates that formatted tickets contain all required information.
 */
@DisplayName("Ticket Formatting - RECQ-US-003")
class TicketFormatterTest {

    private TicketData sampleTicket;

    @BeforeEach
    void setUp() {
        sampleTicket = new TicketData(
                42,
                "Pretoria Central Clinic",
                "PCC01",
                "John Doe",
                "MPI-0000001",
                TokenPriority.NORMAL,
                "2026-09-01 14:30:45",
                "10",
                3,
                8
        );
    }

    @Test
    @DisplayName("HTML ticket contains token number, facility, patient name, and estimated wait")
    void testHtmlTicketContainsAllInfo() {
        String html = TicketFormatter.generateHtmlTicket(sampleTicket);

        assertThat(html)
                .contains("A-0042")  // Formatted token number
                .contains("Pretoria Central Clinic (PCC01)")  // Service station
                .contains("John Doe")  // Patient name
                .contains("MPI-0000001")  // Patient MPI
                .contains("2026-09-01 14:30:45")  // Issue time
                .contains("Position: 3 of 8")  // Queue position
                .contains("10 min")  // Estimated wait
                .contains("QUEUE TICKET")  // Header
                .contains("<!DOCTYPE html>");  // Valid HTML
    }

    @Test
    @DisplayName("HTML ticket shows NORMAL priority in green")
    void testHtmlTicketNormalPriority() {
        String html = TicketFormatter.generateHtmlTicket(sampleTicket);

        assertThat(html)
                .contains("NORMAL")
                .contains("#28a745");  // Green color for normal
    }

    @Test
    @DisplayName("HTML ticket shows PRIORITY in red")
    void testHtmlTicketPriorityHighlight() {
        TicketData priorityTicket = new TicketData(
                42,
                "Pretoria Central Clinic",
                "PCC01",
                "Jane Smith",
                "MPI-0000002",
                TokenPriority.PRIORITY,
                "2026-09-01 14:30:45",
                "5",
                2,
                8
        );

        String html = TicketFormatter.generateHtmlTicket(priorityTicket);

        assertThat(html)
                .contains("PRIORITY")
                .contains("#dc3545");  // Red color for priority
    }

    @Test
    @DisplayName("Plain text ticket contains token number, facility, and patient info")
    void testPlainTextTicketContainsAllInfo() {
        String plainText = TicketFormatter.generatePlainTextTicket(sampleTicket);

        assertThat(plainText)
                .contains("A-0042")  // Formatted token number
                .contains("Pretoria Central Clinic")  // Facility
                .contains("QUEUE TICKET")
                .contains("John Doe")  // Patient name
                .contains("MPI-0000001")  // Patient MPI
                .contains("Position: 3 of 8")
                .contains("Wait: 10 min");
    }

    @Test
    @DisplayName("Formatted token number includes priority prefix")
    void testFormattedTokenNumber() {
        TicketData normalTicket = new TicketData(
                5,
                "Clinic",
                "C01",
                "Patient",
                "MPI-1",
                TokenPriority.NORMAL,
                "2026-09-01 14:30:00",
                "0",
                1,
                5
        );

        assertThat(normalTicket.getFormattedTokenNumber()).isEqualTo("A-0005");

        TicketData priorityTicket = new TicketData(
                5,
                "Clinic",
                "C01",
                "Patient",
                "MPI-1",
                TokenPriority.PRIORITY,
                "2026-09-01 14:30:00",
                "0",
                1,
                5
        );

        assertThat(priorityTicket.getFormattedTokenNumber()).isEqualTo("P-0005");
    }

    @Test
    @DisplayName("Service station formats facility name and code")
    void testServiceStationFormat() {
        assertThat(sampleTicket.getServiceStation())
                .isEqualTo("Pretoria Central Clinic (PCC01)");
    }

    @Test
    @DisplayName("Priority label is correct for NORMAL and PRIORITY")
    void testPriorityLabel() {
        TicketData normalTicket = new TicketData(
                1, "Clinic", "C01", "Patient", "MPI-1",
                TokenPriority.NORMAL,
                "2026-09-01 14:30:00", "0", 1, 5
        );
        assertThat(normalTicket.getPriorityLabel()).isEqualTo("NORMAL");

        TicketData priorityTicket = new TicketData(
                1, "Clinic", "C01", "Patient", "MPI-1",
                TokenPriority.PRIORITY,
                "2026-09-01 14:30:00", "0", 1, 5
        );
        assertThat(priorityTicket.getPriorityLabel()).isEqualTo("PRIORITY");
    }

    @Test
    @DisplayName("Estimated wait display includes minutes")
    void testEstimatedWaitDisplay() {
        assertThat(sampleTicket.getEstimatedWaitDisplay()).isEqualTo("10 min");
    }

    @Test
    @DisplayName("Queue position display shows ordinal and total")
    void testQueuePositionDisplay() {
        assertThat(sampleTicket.getQueuePositionDisplay()).isEqualTo("Position: 3 of 8");
    }

    @Test
    @DisplayName("HTML ticket is valid and printable")
    void testHtmlTicketStructure() {
        String html = TicketFormatter.generateHtmlTicket(sampleTicket);

        // Check for required HTML structure
        assertThat(html)
                .contains("<html>")
                .contains("</html>")
                .contains("<style>")
                .contains("</style>")
                .contains("<body>")
                .contains("</body>")
                .contains("@media print");  // Print-friendly CSS
    }

    @Test
    @DisplayName("Thermal printer bytes are generated without errors")
    void testThermalPrinterOutput() {
        byte[] bytes = TicketFormatter.generateThermalPrinterBytes(sampleTicket);

        assertThat(bytes)
                .isNotNull()
                .isNotEmpty()
                .hasSizeGreaterThan(0);

        // ESC/POS should contain some common command bytes
        String output = new String(bytes);
        assertThat(output)
                .contains("QUEUE TICKET")
                .contains("A-0042")
                .contains("John Doe");
    }
}
