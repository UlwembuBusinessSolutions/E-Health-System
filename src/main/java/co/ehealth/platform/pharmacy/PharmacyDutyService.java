package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.util.*;

@Service
public class PharmacyDutyService {
    private static final Set<String> PRESCRIBERS = Set.of("Doctor","Medical Officer","Professional Nurse","Occupational Health Practitioner");
    private final PharmacyDutyRepository entries;
    private final FacilityRepository facilities;
    private final StaffService staff;
    private final UserRepository users;
    private final PermissionService permissions;
    private final AuditLogService audit;
    private final Clock clock;

    public PharmacyDutyService(PharmacyDutyRepository entries, FacilityRepository facilities, StaffService staff,
            UserRepository users, PermissionService permissions, AuditLogService audit, Clock clock) {
        this.entries=entries; this.facilities=facilities; this.staff=staff; this.users=users;
        this.permissions=permissions; this.audit=audit; this.clock=clock;
    }
    private void lock(UUID facility) {
        var f=facilities.lockForStock(facility).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Clinic not found."));
        if (!f.isActive()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Clinic is inactive.");
    }
    @Transactional(readOnly=true)
    public Status status(UUID facility, UUID actor) {
        permissions.requireAccess(ModuleCode.PHRM,PermissionLevel.VIEW);
        if (!facilities.existsById(facility)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Clinic not found.");
        var active=entries.active(facility,clock.instant());
        var shifts=active.stream().filter(e -> e.dutyType.equals("ON_DUTY")).map(e -> row(e,actor)).toList();
        var absence=active.stream().filter(e -> e.dutyType.equals("NO_DISPENSER")).findFirst().orElse(null);
        return new Status(shifts.isEmpty() ? absence==null ? "UNKNOWN" : "NO_DISPENSER" : "ON_DUTY",
            absence==null ? null : absence.id, absence==null ? null : absence.expiresAt, shifts,
            entries.findTop50ByFacilityIdOrderByStartedAtDesc(facility).stream().map(e -> row(e,actor)).toList());
    }
    @Transactional
    public UUID record(UUID facility, UUID actor, String type, int hours, String reason) {
        permissions.requireAccess(ModuleCode.PHRM,PermissionLevel.MANAGE);
        if (!Set.of("ON_DUTY","NO_DISPENSER").contains(type) || hours<1 || hours>12 || reason==null || reason.isBlank() || reason.length()>500)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a valid duty status, duration and reason.");
        var licence=staff.getLicenseStatus(actor);
        if (type.equals("ON_DUTY") && !licence.canDispense())
            throw new NotLicensedException("A current SAPC registration is required to start a dispenser shift.");
        if (type.equals("NO_DISPENSER") && !(licence.canDispense() ||
            (licence.canPrescribe() && users.findRoleNames(actor).stream().anyMatch(PRESCRIBERS::contains))))
            throw new NotLicensedException("A licensed dispenser or eligible licensed prescriber must confirm availability.");
        lock(facility);
        var now=clock.instant();
        var active=entries.active(facility,now);
        if (type.equals("NO_DISPENSER") && active.stream().anyMatch(e -> e.dutyType.equals("ON_DUTY")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"A dispenser is on duty. Their shift must end before confirming absence.");
        if (type.equals("ON_DUTY") && active.stream().anyMatch(e -> e.dutyType.equals("ON_DUTY") && e.staffId.equals(actor)))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"You already have an active shift at this clinic.");
        // A new shift or refreshed absence supersedes previous absence declarations permanently.
        active.stream().filter(e -> e.dutyType.equals("NO_DISPENSER")).forEach(e -> e.endedAt=now);
        var user=users.findById(actor).orElseThrow();
        var entry=entries.save(new PharmacyDutyEntry(facility,actor,user.getFirstName()+" "+user.getLastName(),
                type,now,now.plus(Duration.ofHours(type.equals("NO_DISPENSER") ? 1 : hours)),reason.trim()));
        audit.append(actor,facility,"PHARMACY_DUTY_"+type,"PharmacyDutyEntry",entry.id.toString(),null,null);
        return entry.id;
    }
    @Transactional
    public void end(UUID facility, UUID id, UUID actor) {
        permissions.requireAccess(ModuleCode.PHRM,PermissionLevel.MANAGE);
        lock(facility);
        var entry=entries.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Duty entry not found."));
        if (!entry.facilityId.equals(facility)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Duty entry not found at this clinic.");
        if (!entry.staffId.equals(actor)) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Only the staff member who recorded this entry can end it.");
        if (entry.endedAt==null) {
            entry.endedAt=clock.instant();
            audit.append(actor,facility,"PHARMACY_DUTY_ENDED","PharmacyDutyEntry",entry.id.toString(),null,null);
        }
    }
    // Called inside the dispensing transaction. The same clinic lock serializes duty changes and stock postings.
    @Transactional
    public UUID requireAbsence(UUID facility) {
        lock(facility);
        var active=entries.active(facility,clock.instant());
        if (active.stream().anyMatch(e -> e.dutyType.equals("ON_DUTY")))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"A dispenser is on duty. Prescriber dispensing is unavailable.");
        return active.stream().filter(e -> e.dutyType.equals("NO_DISPENSER")).map(e -> e.id).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,"Duty status is unknown or expired. Update the duty register first."));
    }
    private Row row(PharmacyDutyEntry e, UUID actor) {
        return new Row(e.id,e.staffName,e.dutyType,e.startedAt,e.expiresAt,e.endedAt,e.reason,e.staffId.equals(actor));
    }
    public record Row(UUID id,String staffName,String dutyType,Instant startedAt,Instant expiresAt,Instant endedAt,String reason,boolean mine) {}
    public record Status(String status,UUID absenceId,Instant absenceExpiresAt,List<Row> activeShifts,List<Row> history) {}
}

