package co.ehealth.platform.clinician;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import co.ehealth.platform.triage.TriageColour;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// The clinician Dashboard: who to see next, the clinician's appointments,
// pharmacy messages about their prescriptions, and how many patients they
// saw per day. Read-only; calling a patient still goes through QueueService,
// which re-checks the queue at that moment.
//
// "Today" and every day boundary are the facility's own calendar days.
@Service
public class ClinicianDashboardService {

    static final int HISTORY_DAYS = 30;
    static final int MESSAGE_DAYS = 7;
    static final int MAX_MESSAGES = 20;
    static final int MAX_WAITING = 100;
    // An appointment is "not arrived" once this long has passed with the
    // patient neither seen nor in the queue.
    static final Duration LATE_AFTER = Duration.ofMinutes(15);

    // South African Triage Scale: how soon a patient of each colour should be
    // seen. One place to change if a facility works to other targets.
    static final Map<TriageColour, Integer> TARGET_MINUTES = Map.of(
            TriageColour.RED, 0, TriageColour.ORANGE, 10, TriageColour.YELLOW, 60, TriageColour.GREEN, 240);

    public enum AppointmentStatus {
        SEEN, IN_QUEUE, NOT_ARRIVED, BOOKED
    }

    public record Dashboard(LocalDate today, Instant generatedAt, boolean canCall, Waiting waiting,
                            List<Appointment> appointments, List<PharmacyMessage> pharmacyMessages,
                            List<DayCount> seenPerDay) {
    }

    // The summary covers everyone waiting; `patients` is capped at MAX_WAITING
    // for display, so counts must never be taken from it. Colour keys are the
    // triage colour names plus NONE for not triaged.
    public record Waiting(int total, long longestWaitMinutes, Map<String, Long> byColour,
                          Map<String, Long> overTargetByColour, List<WaitingPatient> patients) {
    }

    // triageColour and targetMinutes are null for a patient not triaged yet.
    // queuePosition 0 is who "Call next" would take.
    public record WaitingPatient(UUID tokenId, int ticketNumber, boolean priority, Instant issuedAt,
                                 long waitMinutes, int queuePosition, UUID visitId, UUID patientId,
                                 String patientName, Integer age, String gender, String serviceStream,
                                 TriageColour triageColour, Integer targetMinutes, boolean overTarget) {
    }

    public record Appointment(UUID appointmentId, String time, Instant startsAt, UUID patientId, String patientName,
                              AppointmentStatus status) {
    }

    public record PharmacyMessage(UUID messageId, UUID prescriptionId, String serialNumber, UUID patientId,
                                  String patientName, String message, String senderName, Instant sentAt) {
    }

    public record DayCount(LocalDate date, long count) {
    }

    private final ClinicianDashboardRepository repository;
    private final FacilityRepository facilityRepository;
    private final PermissionService permissionService;
    private final Clock clock;

    public ClinicianDashboardService(ClinicianDashboardRepository repository, FacilityRepository facilityRepository,
                                     PermissionService permissionService, Clock clock) {
        this.repository = repository;
        this.facilityRepository = facilityRepository;
        this.permissionService = permissionService;
        this.clock = clock;
    }

    public Dashboard dashboard(UUID facilityId, UUID staffId) {
        permissionService.requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);
        ZoneId zone = ZoneId.of(facilityRepository.findById(facilityId).orElseThrow(FacilityNotFoundException::new)
                .getTimezone());
        Instant now = clock.instant();
        LocalDate today = now.atZone(zone).toLocalDate();
        Instant dayStart = today.atStartOfDay(zone).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(zone).toInstant();

        List<WaitingPatient> waiting = repository.waiting(facilityId, dayStart, dayEnd).stream()
                .map(view -> waitingPatient(view, now, today))
                .sorted(SEE_NEXT_ORDER)
                .toList();

        // Sections the user's role cannot see are left out (null), not failed:
        // the rest of the dashboard still works for them.
        List<Appointment> appointments = permissionService.hasAccess(ModuleCode.APPT, PermissionLevel.VIEW)
                ? repository.appointments(facilityId, staffId, today, dayStart, dayEnd).stream()
                        .map(view -> appointment(view, now)).toList()
                : null;

        List<PharmacyMessage> messages = repository.pharmacyMessages(facilityId, staffId,
                now.minus(Duration.ofDays(MESSAGE_DAYS)), MAX_MESSAGES).stream().map(view -> new PharmacyMessage(
                        view.getMessageId(), view.getPrescriptionId(), view.getSerialNumber(), view.getPatientId(),
                        fullName(view.getPatientFirstName(), view.getPatientLastName()), view.getMessage(),
                        view.getSenderName() == null || view.getSenderName().isBlank() ? null : view.getSenderName().trim(),
                        Instant.ofEpochSecond(view.getSentEpoch())))
                .toList();

        LocalDate historyStart = today.minusDays(HISTORY_DAYS);
        List<DayCount> seenPerDay = perDay(historyStart, today, repository.seenPerDay(facilityId, staffId, zone.getId(),
                historyStart.atStartOfDay(zone).toInstant(), dayStart));

        return new Dashboard(today, now, permissionService.hasAccess(ModuleCode.RECQ, PermissionLevel.MANAGE),
                waitingSummary(waiting), appointments, messages, seenPerDay);
    }

    static Waiting waitingSummary(List<WaitingPatient> sorted) {
        long longest = sorted.stream().mapToLong(WaitingPatient::waitMinutes).max().orElse(0);
        return new Waiting(sorted.size(), longest, countByColour(sorted),
                countByColour(sorted.stream().filter(WaitingPatient::overTarget).toList()),
                sorted.stream().limit(MAX_WAITING).toList());
    }

    private static Map<String, Long> countByColour(List<WaitingPatient> patients) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (String key : List.of("RED", "ORANGE", "NONE", "YELLOW", "GREEN")) {
            counts.put(key, 0L);
        }
        patients.forEach(p -> counts.merge(p.triageColour() == null ? "NONE" : p.triageColour().name(), 1L, Long::sum));
        return counts;
    }

    // Most urgent colour first. A patient not triaged yet sits after red and
    // orange but before yellow: their urgency is unknown, so they are not
    // left at the bottom where a sick patient could wait unseen. Within a
    // colour the longest wait goes first, then queue order.
    static final Comparator<WaitingPatient> SEE_NEXT_ORDER = Comparator
            .comparingInt((WaitingPatient patient) -> urgencyRank(patient.triageColour()))
            .thenComparing(Comparator.comparingLong(WaitingPatient::waitMinutes).reversed())
            .thenComparingInt(WaitingPatient::queuePosition);

    static int urgencyRank(TriageColour colour) {
        if (colour == null) {
            return 2;
        }
        return switch (colour) {
            case RED -> 0;
            case ORANGE -> 1;
            case YELLOW -> 3;
            case GREEN -> 4;
        };
    }

    static WaitingPatient waitingPatient(ClinicianDashboardRepository.WaitingView view, Instant now, LocalDate today) {
        Instant issuedAt = Instant.ofEpochSecond(view.getIssuedEpoch());
        // A clock a little behind the database must not show a negative wait.
        long waitMinutes = Math.max(0, Duration.between(issuedAt, now).toMinutes());
        TriageColour colour = parseColour(view.getTriageColour());
        Integer target = colour == null ? null : TARGET_MINUTES.get(colour);
        return new WaitingPatient(view.getTokenId(), view.getTicketNumber(), "PRIORITY".equals(view.getPriority()),
                issuedAt, waitMinutes, (int) view.getQueuePosition(), view.getVisitId(), view.getPatientId(),
                fullName(view.getFirstName(), view.getLastName()), age(view.getDateOfBirth(), today), view.getGender(),
                view.getServiceStream(), colour, target, target != null && waitMinutes > target);
    }

    static Appointment appointment(ClinicianDashboardRepository.AppointmentView view, Instant now) {
        Instant startsAt = Instant.ofEpochSecond(view.getStartsEpoch());
        AppointmentStatus status = view.getSeen() ? AppointmentStatus.SEEN
                : view.getInQueue() ? AppointmentStatus.IN_QUEUE
                : now.isAfter(startsAt.plus(LATE_AFTER)) ? AppointmentStatus.NOT_ARRIVED
                : AppointmentStatus.BOOKED;
        String time = view.getTime() == null ? "" : view.getTime().substring(0, Math.min(5, view.getTime().length()));
        return new Appointment(view.getAppointmentId(), time, startsAt, view.getPatientId(),
                fullName(view.getFirstName(), view.getLastName()), status);
    }

    // Whole years on the facility's date; null if the date of birth is missing
    // or after today (bad data shows as unknown rather than a negative age).
    static Integer age(String dateOfBirth, LocalDate today) {
        if (dateOfBirth == null || dateOfBirth.isBlank()) {
            return null;
        }
        LocalDate born = LocalDate.parse(dateOfBirth);
        return born.isAfter(today) ? null : Period.between(born, today).getYears();
    }

    // An unknown value (say, a colour added to the database before this
    // code knows it) shows as "not triaged" instead of failing the page.
    static TriageColour parseColour(String colour) {
        if (colour == null) {
            return null;
        }
        try {
            return TriageColour.valueOf(colour);
        } catch (IllegalArgumentException unknown) {
            return null;
        }
    }

    // One entry per day from historyStart up to yesterday, oldest first, zero-filled.
    static List<DayCount> perDay(LocalDate historyStart, LocalDate today,
                                 List<ClinicianDashboardRepository.DayCountView> counts) {
        Map<String, Long> byDay = counts.stream().collect(Collectors.toMap(
                ClinicianDashboardRepository.DayCountView::getDay, ClinicianDashboardRepository.DayCountView::getCount,
                Long::sum));
        List<DayCount> days = new ArrayList<>();
        for (LocalDate day = historyStart; day.isBefore(today); day = day.plusDays(1)) {
            days.add(new DayCount(day, byDay.getOrDefault(day.toString(), 0L)));
        }
        return days;
    }

    private static String fullName(String first, String last) {
        return ((first == null ? "" : first.trim()) + " " + (last == null ? "" : last.trim())).trim();
    }
}
