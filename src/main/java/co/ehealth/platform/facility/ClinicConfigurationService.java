package co.ehealth.platform.facility;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.identity.*;
import co.ehealth.platform.visit.QueueTokenRepository;
import org.springframework.security.core.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
public class ClinicConfigurationService {
    private final DepartmentRepository departments;
    private final ServiceStationRepository stations;
    private final FacilityService facilities;
    private final QueueTokenRepository tokens;
    private final PermissionService permissions;
    private final UserRepository users;
    public ClinicConfigurationService(DepartmentRepository departments, ServiceStationRepository stations,
            FacilityService facilities, QueueTokenRepository tokens, PermissionService permissions, UserRepository users) {
        this.departments=departments; this.stations=stations; this.facilities=facilities; this.tokens=tokens; this.permissions=permissions;
        this.users = users;
    }
    private void requireManager(UUID facilityId) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        boolean orgAdmin = a != null && a.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .anyMatch(x -> x.equals("ROLE_ORG_ADMIN"));
        boolean facilityManager = a != null && a.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .anyMatch(x -> x.equals("ROLE_Facility Manager"));
        boolean assigned = a != null && a.getPrincipal() instanceof AuthenticatedPrincipal principal
                && users.existsFacilityAssignment(principal.userId(), facilityId);
        boolean allowed = orgAdmin || (facilityManager && assigned);
        if (!allowed) throw new NotAuthorizedException(ModuleCode.RECQ, PermissionLevel.MANAGE);
    }
    public List<Department> departments(UUID facilityId) { requireManager(facilityId); facilities.get(facilityId); return departments.findByFacilityIdOrderByName(facilityId); }
    public List<ServiceStation> stations(UUID facilityId) { requireManager(facilityId); facilities.get(facilityId); return stations.findByFacilityIdOrderByName(facilityId); }
    @Transactional public Department addDepartment(UUID f, String n) { requireManager(f); facilities.get(f); return departments.save(new Department(f,n.trim())); }
    @Transactional public ServiceStation addStation(UUID f, UUID d, String n, String c) {
        requireManager(f); facilities.get(f);
        if (d != null) departments.findByIdAndFacilityId(d,f).orElseThrow(() -> new IllegalArgumentException("Department does not belong to this clinic"));
        return stations.save(new ServiceStation(f,d,n.trim(),c == null ? null : c.trim()));
    }
    @Transactional public void deleteDepartment(UUID f, UUID id) { requireManager(f); Department d=departments.findByIdAndFacilityId(id,f).orElseThrow(() -> new IllegalArgumentException("Department not found")); departments.delete(d); }
    @Transactional public void deleteStation(UUID f, UUID id) {
        requireManager(f); ServiceStation s=stations.findByIdAndFacilityId(id,f).orElseThrow(() -> new IllegalArgumentException("Station not found"));
        if (tokens.existsByStationIdAndStatusIn(id, List.of(co.ehealth.platform.visit.TokenStatus.ISSUED, co.ehealth.platform.visit.TokenStatus.CALLED)))
            throw new StationInUseException();
        stations.delete(s);
    }
}
