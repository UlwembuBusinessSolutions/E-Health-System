package co.ehealth.platform.visit;

import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.patient.Patient;
import co.ehealth.platform.patient.PatientService;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * RECQ-US-003: Generates printable ticket data for queue tokens.
 *
 * Ticket shows:
 * - Token number (formatted with priority prefix)
 * - Facility name and code (service station)
 * - Patient name and MPI
 * - Issue time
 * - Priority level
 * - Queue position (ordinal in active queue)
 * - Estimated wait time (based on queue position and average service time)
 */
@Service
public class TicketPrinterService {

    private final QueueTokenRepository queueTokenRepository;
    private final VisitRepository visitRepository;
    private final FacilityRepository facilityRepository;
    private final PatientService patientService;
    private final Clock clock;

    // Average service time per token in minutes
    // This is a configurable parameter; for now using 5 minutes as a baseline
    // In production, this could be pulled from facility configuration or analytics
    private static final int AVERAGE_SERVICE_TIME_MINUTES = 5;

    public TicketPrinterService(QueueTokenRepository queueTokenRepository, VisitRepository visitRepository,
                                 FacilityRepository facilityRepository, PatientService patientService,
                                 Clock clock) {
        this.queueTokenRepository = queueTokenRepository;
        this.visitRepository = visitRepository;
        this.facilityRepository = facilityRepository;
        this.patientService = patientService;
        this.clock = clock;
    }

    /**
     * Generate ticket data for a given queue token.
     * Calculates estimated wait time based on queue position.
     *
     * @param tokenId the UUID of the queue token
     * @return TicketData with all information needed to print the ticket
     * @throws TicketGenerationException if token, visit, or facility not found
     */
    public TicketData generateTicket(UUID tokenId) {
        QueueToken token = queueTokenRepository.findById(tokenId)
                .orElseThrow(() -> new TicketGenerationException("Token not found: " + tokenId));

        if (token.getStatus() != TokenStatus.ISSUED && token.getStatus() != TokenStatus.CALLED) {
            throw new TicketGenerationException("Cannot print ticket for token in status: " + token.getStatus());
        }

        Visit visit = visitRepository.findById(token.getVisitId())
                .orElseThrow(() -> new TicketGenerationException("Visit not found for token: " + tokenId));

        Facility facility = facilityRepository.findById(token.getFacilityId())
                .orElseThrow(() -> new TicketGenerationException("Facility not found: " + token.getFacilityId()));

        Patient patient = patientService.get(visit.getPatientId());

        // Get active queue at this facility to determine position and calculate wait time
        List<QueueToken> activeQueue = queueTokenRepository.findActiveQueue(facility.getId());
        int queuePosition = getPositionInQueue(token, activeQueue);
        String estimatedWait = calculateEstimatedWait(queuePosition);

        // Format issue time
        String issuedAtFormatted = formatInstant(token.getIssuedAt());

        return new TicketData(
                token.getTokenNumber(),
                facility.getName(),
                facility.getCode(),
                patient.getFirstName() + " " + patient.getLastName(),
                patient.getMpiNumber(),
                token.getPriority(),
                issuedAtFormatted,
                estimatedWait,
                queuePosition,
                activeQueue.size()
        );
    }

    /**
     * Calculate the ordinal position of a token in the active queue.
     * Position is 1-indexed (first in queue = 1).
     * If token is not in the active queue, returns the total queue size + 1.
     */
    private int getPositionInQueue(QueueToken token, List<QueueToken> activeQueue) {
        for (int i = 0; i < activeQueue.size(); i++) {
            if (activeQueue.get(i).getId().equals(token.getId())) {
                return i + 1; // 1-indexed
            }
        }
        // Token not in active queue (already called, completed, or cancelled)
        return activeQueue.size() + 1;
    }

    /**
     * Calculate estimated wait time based on queue position.
     * Position 1 (next to be called) = 0 minutes
     * Position 2 = ~5 minutes (average service time)
     * Position 3 = ~10 minutes, etc.
     *
     * @param queuePosition 1-indexed position in queue
     * @return estimated wait time as a string (e.g., "10")
     */
    private String calculateEstimatedWait(int queuePosition) {
        if (queuePosition <= 1) {
            return "0";
        }
        // Position N means (N-1) people ahead, each taking ~AVERAGE_SERVICE_TIME_MINUTES
        int estimatedMinutes = (queuePosition - 1) * AVERAGE_SERVICE_TIME_MINUTES;
        return String.valueOf(estimatedMinutes);
    }

    /**
     * Format an Instant into a human-readable time string.
     * Format: "2026-09-01 14:30:45" (local time in facility's timezone)
     */
    private String formatInstant(Instant instant) {
        LocalDateTime dateTime = LocalDateTime.ofInstant(instant, ZoneOffset.UTC);
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        return dateTime.format(formatter);
    }
}
