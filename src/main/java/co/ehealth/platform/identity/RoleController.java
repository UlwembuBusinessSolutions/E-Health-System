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
        return Map.of("items", roleRepository.findAll().stream()
                .map(r -> Map.of("id", r.getId(), "name", r.getName())).toList());
    }
}
