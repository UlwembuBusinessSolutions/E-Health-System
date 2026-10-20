package co.ehealth.platform.clinician;

import co.ehealth.platform.clinician.ClinicianDashboardService.AppointmentStatus;
import co.ehealth.platform.clinician.ClinicianDashboardService.WaitingPatient;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ClinicianDashboardServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-14T08:05:00Z"); // 10:05 in Johannesburg
    private static final LocalDate TODAY = LocalDate.of(2026, 10, 14);

    private final UUID facilityId = UUID.randomUUID();
    private final UUID staffId = UUID.randomUUID();
    private final ClinicianDashboardRepository repository = mock(ClinicianDashboardRepository.class);
    private final FacilityRepository facilityRepository = mock(FacilityRepository.class);
    private final PermissionService permissions = mock(PermissionService.class);

    // ---- who to see next ----

    @Test
    void seeNextOrderIsRedOrangeNotTriagedYellowGreen() {
        List<String> order = sorted(
                waiting("Green", "GREEN", 30, 0), waiting("Yellow", "YELLOW", 30, 1),
                waiting("Untriaged", null, 30, 2), waiting("Orange", "ORANGE", 30, 3), waiting("Red", "RED", 30, 4));

        assertEquals(List.of("Red", "Orange", "Untriaged", "Yellow", "Green"), order);
    }

    @Test
    void withinAColourTheLongestWaitGoesFirstThenQueueOrder() {
        List<String> order = sorted(
                waiting("Short", "YELLOW", 10, 0), waiting("Long", "YELLOW", 50, 3),
                waiting("Tie later in queue", "YELLOW", 20, 2), waiting("Tie earlier in queue", "YELLOW", 20, 1));

        assertEquals(List.of("Long", "Tie earlier in queue", "Tie later in queue", "Short"), order);
    }

    @Test
    void triageTargetsFollowTheSouthAfricanTriageScale() {
        assertFalse(patient("RED", 0).overTarget());
        assertTrue(patient("RED", 1).overTarget());
        assertFalse(patient("ORANGE", 10).overTarget());
        assertTrue(patient("ORANGE", 11).overTarget());
        assertFalse(patient("YELLOW", 60).overTarget());
        assertTrue(patient("YELLOW", 61).overTarget());
        assertFalse(patient("GREEN", 240).overTarget());
        assertTrue(patient("GREEN", 241).overTarget());
        assertEquals(10, patient("ORANGE", 3).targetMinutes());
    }

    @Test
    void aPatientNotTriagedHasNoTargetAndIsNeverOverIt() {
        WaitingPatient untriaged = patient(null, 500);

        assertNull(untriaged.triageColour());
        assertNull(untriaged.targetMinutes());
        assertFalse(untriaged.overTarget());
    }

    @Test
    void anUnknownColourShowsAsNotTriagedInsteadOfFailing() {
        assertNull(patient("PURPLE", 5).triageColour());
    }

    @Test
    void aTokenStampedAfterNowWaitsZeroMinutesNotNegative() {
        var view = waitingView("Early clock", "GREEN", NOW.plusSeconds(90), 0);
        assertEquals(0, ClinicianDashboardService.waitingPatient(view, NOW, TODAY).waitMinutes());
    }

    @Test
    void waitIsWholeMinutesRoundedDown() {
        var view = waitingView("Waiting", "GREEN", NOW.minusSeconds(47 * 60 + 59), 0);
        assertEquals(47, ClinicianDashboardService.waitingPatient(view, NOW, TODAY).waitMinutes());
    }

    @Test
    void ageIsWholeYearsOnTheFacilitysDate() {
        assertEquals(8, ClinicianDashboardService.age("2018-10-14", TODAY));
        assertEquals(7, ClinicianDashboardService.age("2018-10-15", TODAY));
        assertEquals(0, ClinicianDashboardService.age("2026-10-14", TODAY));
        assertNull(ClinicianDashboardService.age(null, TODAY));
        assertNull(ClinicianDashboardService.age("2027-01-01", TODAY));
    }

    // ---- appointments ----

    @Test
    void appointmentSeenBeatsInQueueBeatsNotArrived() {
        Instant earlier = NOW.minusSeconds(3600);
        assertEquals(AppointmentStatus.SEEN, ClinicianDashboardService.appointment(appointment(earlier, true, true), NOW).status());
        assertEquals(AppointmentStatus.IN_QUEUE, ClinicianDashboardService.appointment(appointment(earlier, false, true), NOW).status());
        assertEquals(AppointmentStatus.NOT_ARRIVED, ClinicianDashboardService.appointment(appointment(earlier, false, false), NOW).status());
    }

    @Test
    void anAppointmentIsOnlyNotArrivedOnceFifteenMinutesHavePassed() {
        assertEquals(AppointmentStatus.BOOKED,
                ClinicianDashboardService.appointment(appointment(NOW.minusSeconds(15 * 60), false, false), NOW).status());
        assertEquals(AppointmentStatus.NOT_ARRIVED,
                ClinicianDashboardService.appointment(appointment(NOW.minusSeconds(15 * 60 + 1), false, false), NOW).status());
        assertEquals(AppointmentStatus.BOOKED,
                ClinicianDashboardService.appointment(appointment(NOW.plusSeconds(3600), false, false), NOW).status());
    }

    @Test
    void appointmentTimeIsShownAsHoursAndMinutes() {
        assertEquals("10:30", ClinicianDashboardService.appointment(appointment(NOW, false, false), NOW).time());
    }

    // ---- history ----

    @Test
    void seenPerDayCoversThirtyFullDaysOldestFirstWithZeroesFilledIn() {
        var days = ClinicianDashboardService.perDay(TODAY.minusDays(30), TODAY,
                List.of(dayCount("2026-10-13", 21), dayCount("2026-09-14", 18)));

        assertEquals(30, days.size());
        assertEquals(LocalDate.of(2026, 9, 14), days.getFirst().date());
        assertEquals(18, days.getFirst().count());
        assertEquals(LocalDate.of(2026, 10, 13), days.getLast().date());
        assertEquals(21, days.getLast().count());
        assertEquals(0, days.get(10).count());
    }

    // ---- the whole dashboard ----

    @Test
    void dayBoundariesAreTheFacilitysMidnightsNotUtc() {
        // 23:30 UTC on 13 Oct is already 01:30 on 14 Oct in Johannesburg.
        ClinicianDashboardService service = serviceAt("2026-10-13T23:30:00Z", true, true);

        var dashboard = service.dashboard(facilityId, staffId);

        assertEquals(TODAY, dashboard.today());
        Instant dayStart = Instant.parse("2026-10-13T22:00:00Z");
        Instant dayEnd = Instant.parse("2026-10-14T22:00:00Z");
        verify(repository).waiting(facilityId, dayStart, dayEnd);
        verify(repository).appointments(facilityId, staffId, TODAY, dayStart, dayEnd);
        verify(repository).seenPerDay(facilityId, staffId, "Africa/Johannesburg", Instant.parse("2026-09-13T22:00:00Z"),
                dayStart);
    }

    @Test
    void withoutAppointmentAccessTheSectionIsLeftOutAndTheRestStillLoads() {
        ClinicianDashboardService service = serviceAt(NOW.toString(), false, false);

        var dashboard = service.dashboard(facilityId, staffId);

        assertNull(dashboard.appointments());
        assertFalse(dashboard.canCall());
        assertEquals(30, dashboard.seenPerDay().size());
        verify(repository, never()).appointments(any(), any(), any(), any(), any());
    }

    @Test
    void withoutQueueAccessTheDashboardIsRefused() {
        ClinicianDashboardService service = serviceAt(NOW.toString(), true, true);
        doThrow(new SecurityException("no access")).when(permissions).requireAccess(ModuleCode.RECQ, PermissionLevel.VIEW);

        assertThrows(SecurityException.class, () -> service.dashboard(facilityId, staffId));
        verify(repository, never()).waiting(any(), any(), any());
    }

    @Test
    void anUnknownFacilityIsNotFound() {
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.empty());
        ClinicianDashboardService service = new ClinicianDashboardService(repository, facilityRepository, permissions,
                Clock.fixed(NOW, ZoneOffset.UTC));

        assertThrows(FacilityNotFoundException.class, () -> service.dashboard(facilityId, staffId));
    }

    @Test
    void aVeryLongQueueIsCappedButTheTotalStaysTrue() {
        ClinicianDashboardService service = serviceAt(NOW.toString(), true, true);
        List<ClinicianDashboardRepository.WaitingView> many = new ArrayList<>();
        IntStream.range(0, 130).forEach(i -> many.add(waitingView("Patient " + i, "GREEN", NOW.minusSeconds(60L * i), i)));
        when(repository.waiting(any(), any(), any())).thenReturn(many);

        var waiting = service.dashboard(facilityId, staffId).waiting();

        assertEquals(130, waiting.total());
        assertEquals(ClinicianDashboardService.MAX_WAITING, waiting.patients().size());
        assertEquals("Patient 129", waiting.patients().getFirst().patientName());
        assertEquals(129, waiting.longestWaitMinutes());
        assertEquals(130L, waiting.byColour().get("GREEN"));
    }

    @Test
    void summaryCountsEveryoneWaitingNotJustTheListShown() {
        List<WaitingPatient> sorted = new ArrayList<>();
        // 100 orange patients fill the shown list; the 20 green ones after them
        // include the longest wait and the only ones over target.
        IntStream.range(0, 100).forEach(i -> sorted.add(waiting("Orange " + i, "ORANGE", 5, i)));
        IntStream.range(0, 20).forEach(i -> sorted.add(waiting("Green " + i, "GREEN", 300 + i, 100 + i)));

        var summary = ClinicianDashboardService.waitingSummary(sorted);

        assertEquals(120, summary.total());
        assertEquals(100, summary.patients().size());
        assertEquals(319, summary.longestWaitMinutes());
        assertEquals(100L, summary.byColour().get("ORANGE"));
        assertEquals(20L, summary.byColour().get("GREEN"));
        assertEquals(0L, summary.byColour().get("NONE"));
        assertEquals(20L, summary.overTargetByColour().get("GREEN"));
        assertEquals(0L, summary.overTargetByColour().get("ORANGE"));
        assertEquals(List.of("RED", "ORANGE", "NONE", "YELLOW", "GREEN"), List.copyOf(summary.byColour().keySet()));
    }

    @Test
    void aMessageWithoutASenderNameHasNoNameRatherThanABlank() {
        ClinicianDashboardService service = serviceAt(NOW.toString(), true, true);
        var message = mock(ClinicianDashboardRepository.MessageView.class);
        when(message.getSenderName()).thenReturn("  ");
        when(message.getPatientFirstName()).thenReturn("Andile");
        when(message.getPatientLastName()).thenReturn("Ngcobo");
        when(message.getSentEpoch()).thenReturn(NOW.getEpochSecond());
        when(repository.pharmacyMessages(any(), any(), any(), anyInt())).thenReturn(List.of(message));

        var messages = service.dashboard(facilityId, staffId).pharmacyMessages();

        assertNull(messages.getFirst().senderName());
        assertEquals("Andile Ngcobo", messages.getFirst().patientName());
        verify(repository).pharmacyMessages(facilityId, staffId, NOW.minusSeconds(7 * 24 * 3600), 20);
    }

    // ---- helpers ----

    private ClinicianDashboardService serviceAt(String instant, boolean appointmentAccess, boolean manageQueue) {
        Facility facility = mock(Facility.class);
        when(facility.getTimezone()).thenReturn("Africa/Johannesburg");
        when(facilityRepository.findById(facilityId)).thenReturn(Optional.of(facility));
        when(permissions.hasAccess(ModuleCode.APPT, PermissionLevel.VIEW)).thenReturn(appointmentAccess);
        when(permissions.hasAccess(ModuleCode.RECQ, PermissionLevel.MANAGE)).thenReturn(manageQueue);
        when(repository.waiting(any(), any(), any())).thenReturn(List.of());
        when(repository.appointments(any(), any(), any(), any(), any())).thenReturn(List.of());
        when(repository.pharmacyMessages(any(), any(), any(), anyInt())).thenReturn(List.of());
        when(repository.seenPerDay(any(), any(), anyString(), any(), any())).thenReturn(List.of());
        return new ClinicianDashboardService(repository, facilityRepository, permissions,
                Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
    }

    private static List<String> sorted(WaitingPatient... patients) {
        return List.of(patients).stream().sorted(ClinicianDashboardService.SEE_NEXT_ORDER)
                .map(WaitingPatient::patientName).toList();
    }

    private static WaitingPatient waiting(String name, String colour, long waitMinutes, int position) {
        return ClinicianDashboardService.waitingPatient(
                waitingView(name, colour, NOW.minusSeconds(waitMinutes * 60), position), NOW, TODAY);
    }

    private static WaitingPatient patient(String colour, long waitMinutes) {
        return waiting("Patient", colour, waitMinutes, 0);
    }

    private static ClinicianDashboardRepository.WaitingView waitingView(String name, String colour, Instant issuedAt,
                                                                        int position) {
        var view = mock(ClinicianDashboardRepository.WaitingView.class);
        when(view.getTokenId()).thenReturn(UUID.randomUUID());
        when(view.getFirstName()).thenReturn(name);
        when(view.getLastName()).thenReturn("");
        when(view.getPriority()).thenReturn("NORMAL");
        when(view.getIssuedEpoch()).thenReturn(issuedAt.getEpochSecond());
        when(view.getQueuePosition()).thenReturn((long) position);
        when(view.getTriageColour()).thenReturn(colour);
        when(view.getDateOfBirth()).thenReturn("1990-01-01");
        return view;
    }

    private static ClinicianDashboardRepository.AppointmentView appointment(Instant startsAt, boolean seen,
                                                                            boolean inQueue) {
        var view = mock(ClinicianDashboardRepository.AppointmentView.class);
        when(view.getTime()).thenReturn("10:30:00");
        when(view.getStartsEpoch()).thenReturn(startsAt.getEpochSecond());
        when(view.getSeen()).thenReturn(seen);
        when(view.getInQueue()).thenReturn(inQueue);
        when(view.getFirstName()).thenReturn("Lerato");
        when(view.getLastName()).thenReturn("Khumalo");
        return view;
    }

    private static ClinicianDashboardRepository.DayCountView dayCount(String day, long count) {
        var view = mock(ClinicianDashboardRepository.DayCountView.class);
        when(view.getDay()).thenReturn(day);
        when(view.getCount()).thenReturn(count);
        return view;
    }
}
