package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.*;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PrescriberDispensingReportService {
    private final EntityManager em;
    private final PermissionService permissions;
    private final AuditLogService audit;
    public PrescriberDispensingReportService(EntityManager em, PermissionService permissions, AuditLogService audit) {
        this.em=em; this.permissions=permissions; this.audit=audit;
    }
    private static final String FROM = """
        from DispensingRecord d
        join PrescriptionItem i on i.id=d.prescriptionItemId
        join Prescription p on p.id=i.prescriptionId
        join Patient patient on patient.id=p.patientId
        join User staff on staff.id=d.dispensedByUserId
        join Facility f on f.id=p.facilityId
        left join PharmacyDutyEntry duty on duty.id=d.dutyEntryId
        where d.prescriberDispensed=true and p.facilityId=:facility
          and d.dispensedAt>=:start and d.dispensedAt<:end
        """;
    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Report report(UUID facility, LocalDate from, LocalDate to, int page, int size) {
        permissions.requireAccess(ModuleCode.PHRM,PermissionLevel.VIEW);
        validate(from,to,page,size);
        var start=from.atStartOfDay(ZoneOffset.UTC).toInstant();
        var end=to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        long total=em.createQuery("select count(d.id) "+FROM,Long.class)
            .setParameter("facility",facility).setParameter("start",start).setParameter("end",end).getSingleResult();
        var values=em.createQuery("""
            select d.id,p.serialNumber,patient.mpiNumber,concat(patient.firstName,' ',patient.lastName),
                   f.name,i.drugName,i.quantity,concat(staff.firstName,' ',staff.lastName),d.dispensedAt,
                   d.dutyEntryId,duty.reason
            """+FROM+" order by d.dispensedAt desc,d.id",Object[].class)
            .setParameter("facility",facility).setParameter("start",start).setParameter("end",end)
            .setFirstResult(Math.multiplyExact(page,size)).setMaxResults(size).getResultList();
        var items=values.stream().map(v -> new Row((UUID)v[0],(String)v[1],(String)v[2],(String)v[3],(String)v[4],
            (String)v[5],((Number)v[6]).intValue(),(String)v[7],(Instant)v[8],(UUID)v[9],(String)v[10])).toList();
        return new Report(items,total,page,size);
    }
    @Transactional(isolation=Isolation.REPEATABLE_READ)
    public String export(UUID facility,LocalDate from,LocalDate to,UUID actor) {
        var report=report(facility,from,to,0,10000);
        if (report.totalItems()>10000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Export exceeds 10,000 medicine rows. Narrow the date range.");
        audit.append(actor,facility,"PRESCRIBER_DISPENSING_REPORT_EXPORTED","Facility",facility.toString(),null,
            "{\"from\":\""+from+"\",\"to\":\""+to+"\",\"rows\":"+report.totalItems()+"}");
        var csv=new StringBuilder("Prescription,MPI,Patient,Clinic,Medicine,Quantity,Dispensed by,Dispensed at UTC,Duty entry,Availability reason,Prescriber dispensed\r\n");
        for(var r:report.items()) csv.append(Arrays.asList(r.serialNumber(),r.mpi(),r.patientName(),r.facilityName(),
            r.medicine(),Integer.toString(r.quantity()),r.dispensedBy(),r.dispensedAt().toString(),
            r.dutyEntryId()==null ? "" : r.dutyEntryId().toString(),r.dutyReason()==null ? "Legacy staff confirmation" : r.dutyReason(),"Yes")
            .stream().map(PrescriberDispensingReportService::csvCell).collect(Collectors.joining(","))).append("\r\n");
        return csv.toString();
    }
    static String csvCell(String value) {
        String safe=value;
        String trimmed=value.stripLeading();
        if ((!trimmed.isEmpty() && "=+@-".indexOf(trimmed.charAt(0))>=0) || value.startsWith("\t") || value.startsWith("\r"))
            safe="'"+value;
        return "\"" + safe.replace("\"","\"\"") + "\"";
    }
    private void validate(LocalDate from,LocalDate to,int page,int size) {
        if (from==null || to==null || to.isBefore(from) || ChronoUnit.DAYS.between(from,to)>365 || page<0 || page>100000 || size<1 || size>10000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Use a valid date range of at most 366 days and valid pagination.");
    }
    public record Row(UUID id,String serialNumber,String mpi,String patientName,String facilityName,String medicine,
        int quantity,String dispensedBy,Instant dispensedAt,UUID dutyEntryId,String dutyReason) {}
    public record Report(List<Row> items,long totalItems,int page,int size) {}
}

