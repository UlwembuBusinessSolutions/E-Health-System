package co.ehealth.platform.facility;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

// GET only exists to feed the admin staff-creation form's clinic dropdown.
// POST is the minimum write this slice can't skip — see FacilityService's
// why-note. Full Facility CRUD is Backend 1's territory, out of scope here;
// SecurityConfig gates POST to ORG_ADMIN specifically, since GET already
// needs to stay open to any authenticated staff member.
@RestController
public class FacilityController {

    private final FacilityRepository facilityRepository;
    private final FacilityService facilityService;

    public FacilityController(FacilityRepository facilityRepository, FacilityService facilityService) {
        this.facilityRepository = facilityRepository;
        this.facilityService = facilityService;
    }

    @GetMapping("/api/v1/facilities")
    public Map<String, Object> list() {
        return Map.of("items", facilityRepository.findByActiveTrue().stream()
                .map(f -> Map.of("id", f.getId(), "name", f.getName())).toList());
    }

    @PostMapping("/api/v1/facilities")
    public ResponseEntity<FacilitySummary> create(@Valid @RequestBody CreateFacilityRequest request) {
        Facility facility = facilityService.create(request.name(), request.code(), request.type(),
                request.address(), request.phone());
        return ResponseEntity.status(HttpStatus.CREATED).body(FacilitySummary.from(facility));
    }

    public record CreateFacilityRequest(
            @NotBlank String name, @NotBlank @Size(max = 20) String code,
            @NotNull FacilityType type, String address, String phone) {
    }

    public record FacilitySummary(UUID id, String name, String code, FacilityType type) {
        static FacilitySummary from(Facility f) {
            return new FacilitySummary(f.getId(), f.getName(), f.getCode(), f.getType());
        }
    }
}
