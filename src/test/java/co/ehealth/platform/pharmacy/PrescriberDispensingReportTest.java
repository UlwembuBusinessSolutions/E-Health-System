package co.ehealth.platform.pharmacy;

import co.ehealth.platform.core.audit.AuditLogService;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PrescriberDispensingReportTest {
    @Test void dutyReadsAndWritesRequirePharmacyPermissions() {
        var permissions=mock(PermissionService.class);
        var entries=mock(PharmacyDutyRepository.class);
        var facilities=mock(co.ehealth.platform.facility.FacilityRepository.class);
        var staff=mock(StaffService.class);
        var users=mock(UserRepository.class);
        var audit=mock(AuditLogService.class);
        var service=new PharmacyDutyService(entries,facilities,staff,users,permissions,audit,java.time.Clock.systemUTC());
        doThrow(new NotAuthorizedException(ModuleCode.PHRM,PermissionLevel.VIEW))
            .when(permissions).requireAccess(ModuleCode.PHRM,PermissionLevel.VIEW);
        doThrow(new NotAuthorizedException(ModuleCode.PHRM,PermissionLevel.MANAGE))
            .when(permissions).requireAccess(ModuleCode.PHRM,PermissionLevel.MANAGE);
        var id=UUID.randomUUID();
        assertThrows(NotAuthorizedException.class, () -> service.status(id,id));
        assertThrows(NotAuthorizedException.class, () -> service.record(id,id,"ON_DUTY",8,"Shift"));
        assertThrows(NotAuthorizedException.class, () -> service.end(id,id,id));
        verifyNoInteractions(entries,facilities,staff,users,audit);
    }
    @Test void csvEscapesQuotesAndNeutralizesSpreadsheetFormulas() {
        assertEquals("\"'  =SUM(A1)\nnext\"", PrescriberDispensingReportService.csvCell("  =SUM(A1)\nnext"));
        assertEquals("\"a,\"\"b\"", PrescriberDispensingReportService.csvCell("a,\"b"));
        assertEquals("\"'+cmd\"", PrescriberDispensingReportService.csvCell("+cmd"));
        assertEquals("\"Medicine\"", PrescriberDispensingReportService.csvCell("Medicine"));
    }
    @Test void reportAndExportRequirePharmacyViewBeforeQuerying() {
        var permissions=mock(PermissionService.class);
        var em=mock(EntityManager.class);
        var audit=mock(AuditLogService.class);
        doThrow(new NotAuthorizedException(ModuleCode.PHRM,PermissionLevel.VIEW))
            .when(permissions).requireAccess(ModuleCode.PHRM,PermissionLevel.VIEW);
        var service=new PrescriberDispensingReportService(em,permissions,audit);
        assertThrows(NotAuthorizedException.class, () -> service.report(UUID.randomUUID(),LocalDate.now(),LocalDate.now(),0,25));
        assertThrows(NotAuthorizedException.class, () -> service.export(UUID.randomUUID(),LocalDate.now(),LocalDate.now(),UUID.randomUUID()));
        verifyNoInteractions(em,audit);
    }
}
