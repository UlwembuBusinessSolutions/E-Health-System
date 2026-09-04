package co.ehealth.platform.identity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// Same shape as facility.FacilityController — only exists to feed the
// admin staff-creation form's role dropdown. Full role management (create,
// edit, assign permissions) is out of scope for this slice.
@RestController
public class RoleController {

    private final RoleRepository roleRepository;

    public RoleController(RoleRepository roleRepository) {
        this.roleRepository = roleRepository;
    }

    @GetMapping("/api/v1/roles")
    public Map<String, Object> list() {
        // Filters out any platform-reserved role name (ReservedRoleNames)
        // before it ever reaches the dropdown — belt-and-suspenders against
        // StaffService's own server-side rejection, in case a future seed
        // migration ever puts one in this tenant's roles table by mistake.
        return Map.of("items", roleRepository.findAll().stream()
                .filter(r -> !ReservedRoleNames.isReserved(r.getName()))
                .map(r -> Map.of("id", r.getId(), "name", r.getName())).toList());
    }
}
