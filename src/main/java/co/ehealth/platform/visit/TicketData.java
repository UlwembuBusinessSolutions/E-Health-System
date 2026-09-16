package co.ehealth.platform.visit;

import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.patient.Patient;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * RECQ-US-003: Printable ticket data for a queue token.
 * Contains all information needed to display/print a physical ticket.
 */
public record TicketData(
        int tokenNumber,
        String facilityName,
        String facilityCode,
        String patientName,
        String patientMpi,
        TokenPriority priority,
        String issuedAtFormatted,
        String estimatedWaitMinutes,
        int queuePosition,
        int totalInQueue
) {
    // Format token numbers with leading zeros for readability (e.g., "A-0042")
    public String getFormattedTokenNumber() {
        String priorityPrefix = priority == TokenPriority.PRIORITY ? "P" : "A";
        return priorityPrefix + "-" + String.format("%04d", tokenNumber);
    }

    // Human-readable service station (facility name and code)
    public String getServiceStation() {
        return facilityName + " (" + facilityCode + ")";
    }

    // Priority display label
    public String getPriorityLabel() {
        return priority == TokenPriority.PRIORITY ? "PRIORITY" : "NORMAL";
    }

    // Estimated wait time display
    public String getEstimatedWaitDisplay() {
        return estimatedWaitMinutes + " min";
    }

    // Queue position display
    public String getQueuePositionDisplay() {
        return "Position: " + queuePosition + " of " + totalInQueue;
    }
}
