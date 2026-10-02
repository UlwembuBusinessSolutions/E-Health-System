package co.ehealth.platform.appointment;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.notification.EmailService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.*;
import co.ehealth.platform.identity.*;
import co.ehealth.platform.patient.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Stream;

@Service
public class AppointmentService {
    private static final Logger log = LoggerFactory.getLogger(AppointmentService.class);
    private static final DateTimeFormatter EMAIL_DATE = DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter EMAIL_TIME = DateTimeFormatter.ofPattern("HH:mm");

    // Interim stopgap for "does this clinician already have something too
    // close to this time" — the plan doc's own §5.3 defers the real fix
    // (per-service-type slot durations, a proper resource/capacity model)
    // to a later APPT slice. Until that exists there is no appointment
    // duration to check overlap against, so this is a flat minimum gap
    // between any two of the same staff member's appointments on the same
    // day instead — 30 minutes, a common single-consult length; reasonable
    // to make configurable per facility later (same shape as the existing
    // daily visit limit) if 30 turns out wrong for some service types.
    private static final Duration MIN_STAFF_GAP = Duration.ofMinutes(30);

    private final AppointmentRepository appointments;
    private final FacilityRepository facilities;
    private final PatientRepository patients;
    private final AppointmentStaffRepository staff;
    private final PermissionService permissions;
    private final AuditLogService audit;
    private final EmailService emailService;
    private final OrganizationRepository organizations;
    private final Clock clock;

    public AppointmentService(AppointmentRepository appointments, FacilityRepository facilities,
            PatientRepository patients, AppointmentStaffRepository staff, PermissionService permissions, AuditLogService audit,
            EmailService emailService, OrganizationRepository organizations, Clock clock) {
        this.appointments = appointments; this.facilities = facilities; this.patients = patients;
        this.permissions = permissions; this.audit = audit; this.clock = clock;
        this.staff = staff; this.emailService = emailService; this.organizations = organizations;
    }

    public record Settings(UUID facilityId, String facilityName, String timezone, Integer dailyLimit) {}
    // createdByName/createdAt were always captured on Appointment itself
    // (createdBy has been used for the idempotent-retry check since the
    // very first slice) but never surfaced past this service until now —
    // "who booked this" is free given the data already exists, unlike an
    // online-vs-staff source, which would have nothing to distinguish from
    // until a second (patient self-service) booking path actually exists.
    public record Entry(UUID id, UUID patientId, String patientName, String mpiNumber, LocalDate date,
            LocalTime time, Instant startsAt, String status, String cancelReason, String notes, long version,
            UUID assignedStaffId, String assignedStaffName, String createdByName, Instant createdAt) {}
    public record Diary(List<Entry> items, long totalItems, boolean hasMore, LocalDate date,
            String timezone, long booked, Integer dailyLimit, Long remaining, boolean canManage) {}

    @Transactional(readOnly = true)
    public List<AppointmentStaffRepository.StaffOption> availableStaff(UUID facilityId) {
        permissions.requireAccess(ModuleCode.APPT, PermissionLevel.VIEW);
        facilities.findById(facilityId).orElseThrow(FacilityNotFoundException::new);
        return staff.findAvailable(facilityId);
    }

    @Transactional(readOnly = true)
    public List<Settings> settings() {
        requireAdmin();
        return facilities.findByActiveTrueOrderByNameAsc().stream().map(this::settingsView).toList();
    }

    @Transactional
    public Settings updateLimit(UUID facilityId, Integer limit, UUID actor) {
        requireAdmin();
        if (limit != null && limit < 1) throw new AppointmentException(400, "Daily visit limit must be a positive whole number.");
        Facility facility = lock(facilityId);
        String before = String.valueOf(facility.getDailyAppointmentLimit());
        facility.setDailyAppointmentLimit(limit);
        audit.append(actor, facilityId, "APPOINTMENT_LIMIT_UPDATED", "Facility", facilityId.toString(), before, String.valueOf(limit));
        return settingsView(facility);
    }

    // Unfiltered convenience overload — every existing caller (and most of
    // this file's own tests) that never cared about the newer display
    // filters below keeps working unchanged.
    @Transactional(readOnly = true)
    public Diary diary(UUID facilityId, LocalDate date, int page) {
        return diary(facilityId, date, page, null, false, null);
    }

    // assignedStaffId/unassignedOnly/status are display filters only — they
    // narrow which appointments this call returns, never the booked/
    // remaining daily-limit counts below, which must keep reflecting the
    // facility's real capacity regardless of what the caller is currently
    // looking at.
    @Transactional(readOnly = true)
    public Diary diary(UUID facilityId, LocalDate date, int page, UUID assignedStaffId, boolean unassignedOnly, String status) {
        permissions.requireAccess(ModuleCode.APPT, PermissionLevel.VIEW);
        Facility facility = facilities.findById(facilityId).orElseThrow(FacilityNotFoundException::new);
        LocalDate day = date == null ? LocalDate.now(clock.withZone(ZoneId.of(facility.getTimezone()))) : date;
        var result = appointments.search(facilityId, day, status, unassignedOnly, assignedStaffId, PageRequest.of(Math.max(0, page), 50));
        Map<UUID, Patient> names = new HashMap<>();
        patients.findAllById(result.getContent().stream().map(a -> a.patientId).distinct().toList()).forEach(p -> names.put(p.getId(), p));
        long booked = count(facilityId, day);
        Integer limit = facility.getDailyAppointmentLimit();
        // One batched lookup covers both assignedStaffId and createdBy —
        // createdBy is never null, so every row contributes at least one id.
        Map<UUID, String> staffNames = new HashMap<>();
        var staffIds = Stream.concat(result.getContent().stream().map(a -> a.assignedStaffId),
                        result.getContent().stream().map(a -> a.createdBy))
                .filter(Objects::nonNull).distinct().toList();
        if (!staffIds.isEmpty()) staff.findNames(staffIds).forEach(s -> staffNames.put(s.getId(), s.getName()));
        return new Diary(result.getContent().stream().map(a -> view(a, names.get(a.patientId), staffNames)).toList(), result.getTotalElements(), result.hasNext(), day,
                facility.getTimezone(), booked, limit, limit == null ? null : Math.max(0L, limit - booked), permissions.hasAccess(ModuleCode.APPT, PermissionLevel.MANAGE));
    }

    @Transactional
    public Entry book(UUID facilityId, UUID requestId, UUID patientId, LocalDate date, LocalTime time, UUID assignedStaffId, String notes, UUID actor) {
        permissions.requireAccess(ModuleCode.APPT, PermissionLevel.MANAGE);
        String normalizedNotes = normalizeNotes(notes);
        Facility facility = lock(facilityId);
        var existing = appointments.findById(requestId);
        if (existing.isPresent()) {
            Appointment a = existing.get();
            if (!a.facilityId.equals(facilityId) || !a.patientId.equals(patientId) || !a.createdBy.equals(actor)
                    || !a.appointmentDate.equals(date) || !a.appointmentTime.equals(time) || !Objects.equals(a.assignedStaffId, assignedStaffId)
                    || !Objects.equals(a.notes, normalizedNotes))
                throw new AppointmentException(409, "This booking request has already been used. Refresh and try again.");
            return view(a, patient(a.patientId));
        }
        Patient patient = patient(patientId);
        if (patient.isArchived()) throw new AppointmentException(400, "Appointments can only be booked for active registered patients.");
        Instant start = validateTime(facility, date, time);
        validateStaff(facilityId, assignedStaffId);
        checkStaffAvailability(facilityId, assignedStaffId, date, time, requestId);
        checkCapacity(facility, date);
        Appointment a = new Appointment(requestId, facilityId, patientId, date, time, start, actor, clock.instant());
        a.assignedStaffId = assignedStaffId;
        a.notes = normalizedNotes;
        appointments.saveAndFlush(a);
        audit.append(actor, facilityId, "APPOINTMENT_BOOKED", "Appointment", a.id.toString(), null, scheduleJson(a));
        Entry entry = view(a, patient);
        sendConfirmationAfterCommit(a, patient, facility, entry.assignedStaffName(), false);
        return entry;
    }

    @Transactional
    public Entry reschedule(UUID facilityId, UUID id, LocalDate date, LocalTime time, UUID assignedStaffId, String notes, long version, UUID actor) {
        permissions.requireAccess(ModuleCode.APPT, PermissionLevel.MANAGE);
        Facility facility = lock(facilityId);
        Appointment a = appointment(facilityId, id);
        if (!a.status.equals("CONFIRMED")) throw new AppointmentException(409, "A cancelled appointment cannot be rescheduled.");
        String normalizedNotes = normalizeNotes(notes);
        if (a.appointmentDate.equals(date) && a.appointmentTime.equals(time) && Objects.equals(a.assignedStaffId, assignedStaffId)
                && Objects.equals(a.notes, normalizedNotes)) return view(a, patient(a.patientId));
        checkVersion(a, version);
        Instant start = validateTime(facility, date, time);
        validateStaff(facilityId, assignedStaffId);
        checkStaffAvailability(facilityId, assignedStaffId, date, time, a.id);
        if (!a.appointmentDate.equals(date)) checkCapacity(facility, date);
        boolean scheduleChanged = !a.appointmentDate.equals(date) || !a.appointmentTime.equals(time)
                || !Objects.equals(a.assignedStaffId, assignedStaffId);
        String before = scheduleJson(a);
        a.appointmentDate = date; a.appointmentTime = time; a.startsAt = start;
        a.assignedStaffId = assignedStaffId;
        a.notes = normalizedNotes;
        appointments.flush();
        audit.append(actor, facilityId, "APPOINTMENT_RESCHEDULED", "Appointment", a.id.toString(), before, scheduleJson(a));
        Patient patient = patient(a.patientId);
        Entry entry = view(a, patient);
        if (scheduleChanged) sendConfirmationAfterCommit(a, patient, facility, entry.assignedStaffName(), true);
        return entry;
    }

    @Transactional
    public Entry cancel(UUID facilityId, UUID id, String reason, long version, UUID actor) {
        permissions.requireAccess(ModuleCode.APPT, PermissionLevel.MANAGE);
        lock(facilityId);
        Appointment a = appointment(facilityId, id);
        if (a.status.equals("CANCELLED")) return view(a, patient(a.patientId));
        checkVersion(a, version);
        if (reason == null || reason.isBlank() || reason.length() > 500) throw new AppointmentException(400, "Enter a cancellation reason (up to 500 characters).");
        a.status = "CANCELLED"; a.cancelReason = reason.trim();
        appointments.flush();
        audit.append(actor, facilityId, "APPOINTMENT_CANCELLED", "Appointment", a.id.toString(), "{\"status\":\"CONFIRMED\"}",
                com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode().put("status", "CANCELLED").put("reason", a.cancelReason).toString());
        return view(a, patient(a.patientId));
    }

    // Blank and whitespace-only collapse to null — same "no ambiguous
    // empty-string state" reasoning applied elsewhere in this codebase
    // (e.g. StaffService.UpdateStaffDetailsCommand's optional fields).
    private String normalizeNotes(String notes) {
        if (notes == null) return null;
        if (notes.length() > 1000) throw new AppointmentException(400, "Appointment notes must be 1000 characters or fewer.");
        String trimmed = notes.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    // Renamed from assignedStaffName — reused for createdBy too (below),
    // which is any staff member regardless of role, not just an assigned
    // clinician; the lookup itself never cared which kind of "staff id" it
    // was given.
    private String staffDisplayName(UUID userId) {
        if (userId == null) return null;
        return staff.findNames(List.of(userId)).stream().findFirst()
                .map(AppointmentStaffRepository.StaffOption::getName).orElse(null);
    }

    // Dispatch only after commit: a rolled-back booking must never produce
    // a confirmation, and an idempotent retry returns before registering this.
    // Snapshot the details while entities and the request tenant are available.
    private void sendConfirmationAfterCommit(Appointment a, Patient patient, Facility facility, String staffName, boolean updated) {
        String toEmail = patient.getEmail();
        if (toEmail == null || toEmail.isBlank()) return;
        UUID appointmentId = a.id;
        String tenant = TenantContext.getCurrentTenant();
        String firstName = patient.getFirstName(), facilityName = facility.getName();
        ZonedDateTime local = a.startsAt.atZone(ZoneId.of(facility.getTimezone()));
        String date = local.format(EMAIL_DATE);
        String offset = local.getOffset().equals(ZoneOffset.UTC) ? "+00:00" : local.getOffset().toString();
        String time = local.format(EMAIL_TIME) + " (" + facility.getTimezone() + ", UTC" + offset + ")";
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try {
                    Organization organization = organizations.findBySchemaName(tenant).orElse(null);
                    if (organization == null) {
                        log.warn("Could not queue appointment confirmation for {}: organization unavailable", appointmentId);
                        return;
                    }
                    if (updated) emailService.sendAppointmentUpdatedEmail(toEmail, firstName, organization.getDisplayName(),
                            facilityName, date, time, staffName);
                    else emailService.sendAppointmentConfirmedEmail(toEmail, firstName, organization.getDisplayName(),
                            facilityName, date, time, staffName);
                } catch (RuntimeException e) {
                    // SMTP is asynchronous. Dispatch/configuration failures also must
                    // leave the successfully committed appointment available to staff.
                    log.warn("Could not queue appointment confirmation for {}", appointmentId, e);
                }
            }
        });
    }

    private void requireAdmin() { permissions.requireAnyRole(Set.of("ORG_ADMIN"), "Only organization administrators can change appointment settings."); }
    private String scheduleJson(Appointment a) {
        return com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode().put("date", a.appointmentDate.toString())
                .put("time", a.appointmentTime.toString()).put("assignedStaffId", a.assignedStaffId == null ? null : a.assignedStaffId.toString()).toString();
    }
    private void validateStaff(UUID facilityId, UUID staffId) {
        if (staffId != null && staff.findAvailable(facilityId).stream().noneMatch(s -> s.getId().equals(staffId)))
            throw new AppointmentException(400, "Choose an active staff member assigned to this facility, or leave the appointment unassigned.");
    }

    // MIN_STAFF_GAP's own why-note explains the stopgap; this just enforces
    // it. Safe against concurrent double-booking without its own lock: both
    // book() and reschedule() already run inside lock(facilityId)'s
    // transaction, and every appointment sharing a facility (therefore every
    // appointment this check could ever compare against) is scoped under
    // that same lock — the same guarantee checkCapacity() already leans on.
    // Skipped entirely when unassigned; nothing to collide with.
    private void checkStaffAvailability(UUID facilityId, UUID staffId, LocalDate date, LocalTime time, UUID excludeAppointmentId) {
        if (staffId == null) return;
        for (Appointment other : appointments.findByFacilityIdAndAssignedStaffIdAndAppointmentDateAndStatusNot(
                facilityId, staffId, date, "CANCELLED")) {
            if (other.id.equals(excludeAppointmentId)) continue;
            if (Duration.between(other.appointmentTime, time).abs().compareTo(MIN_STAFF_GAP) < 0) {
                throw new AppointmentException(409, "This clinician already has an appointment at "
                        + other.appointmentTime + " that day — choose a time at least "
                        + MIN_STAFF_GAP.toMinutes() + " minutes apart, or a different clinician.");
            }
        }
    }
    private Settings settingsView(Facility f) { return new Settings(f.getId(), f.getName(), f.getTimezone(), f.getDailyAppointmentLimit()); }
    private Facility lock(UUID id) {
        Facility f = facilities.lockForAppointments(id).orElseThrow(FacilityNotFoundException::new);
        if (!f.isActive()) throw new AppointmentException(400, "This facility is inactive.");
        return f;
    }
    private Patient patient(UUID id) { return patients.findById(id).orElseThrow(() -> new AppointmentException(404, "Patient not found.")); }
    private Appointment appointment(UUID facilityId, UUID id) {
        return appointments.findById(id).filter(a -> a.facilityId.equals(facilityId)).orElseThrow(() -> new AppointmentException(404, "Appointment not found."));
    }
    private long count(UUID facilityId, LocalDate day) { return appointments.countByFacilityIdAndAppointmentDateAndStatusNot(facilityId, day, "CANCELLED"); }
    private void checkCapacity(Facility f, LocalDate date) {
        Integer limit = f.getDailyAppointmentLimit();
        if (limit != null) {
            long booked = count(f.getId(), date);
            if (booked >= limit) throw new AppointmentException(409, "Daily appointment limit reached (" + booked + " of " + limit + "). Choose another date.");
        }
    }
    private void checkVersion(Appointment a, long version) {
        if (a.version != version) throw new AppointmentException(409, "This appointment has changed. Refresh and try again.");
    }
    private Instant validateTime(Facility f, LocalDate date, LocalTime time) {
        var local = LocalDateTime.of(date, time);
        var offsets = ZoneId.of(f.getTimezone()).getRules().getValidOffsets(local);
        if (offsets.size() != 1) throw new AppointmentException(400, "This local time is unavailable or ambiguous. Choose another time.");
        Instant start = local.toInstant(offsets.getFirst());
        if (!start.isAfter(clock.instant())) throw new AppointmentException(400, "Choose an appointment time in the future.");
        return start;
    }
    private Entry view(Appointment a, Patient p) {
        return new Entry(a.id, a.patientId, p == null ? "Unknown patient" : p.getFirstName() + " " + p.getLastName(),
                p == null ? "" : p.getMpiNumber(), a.appointmentDate, a.appointmentTime, a.startsAt, a.status, a.cancelReason,
                a.notes, a.version, a.assignedStaffId, staffDisplayName(a.assignedStaffId), staffDisplayName(a.createdBy), a.createdAt);
    }
    // diary()'s own batched variant — staffNames already covers both
    // assignedStaffId and createdBy in one lookup, so no per-row query here.
    private Entry view(Appointment a, Patient p, Map<UUID, String> staffNames) {
        return new Entry(a.id, a.patientId, p == null ? "Unknown patient" : p.getFirstName() + " " + p.getLastName(),
                p == null ? "" : p.getMpiNumber(), a.appointmentDate, a.appointmentTime, a.startsAt, a.status, a.cancelReason,
                a.notes, a.version, a.assignedStaffId, staffNames.get(a.assignedStaffId), staffNames.get(a.createdBy), a.createdAt);
    }
}
