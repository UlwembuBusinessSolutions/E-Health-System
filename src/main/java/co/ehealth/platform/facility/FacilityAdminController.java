package co.ehealth.platform.facility;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

// TenantContext selects the organization's schema. SecurityConfig restricts /admin/** to ORG_ADMIN.
@RestController
@RequestMapping("/api/v1/admin/facilities")
public class FacilityAdminController {
    private final FacilityService service;

    public FacilityAdminController(FacilityService service) { this.service = service; }

    @GetMapping
    public Map<String, List<FacilityDetails>> list() {
        return Map.of("items", service.list().stream().map(FacilityDetails::from).toList());
    }

    @PostMapping
    public ResponseEntity<FacilityDetails> create(@Valid @RequestBody FacilityRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(FacilityDetails.from(service.create(
                request.name().trim(), request.code().trim(), request.type(),
                request.address(), request.phone(), request.operatingHours())));
    }

    @PatchMapping("/{id}")
    public FacilityDetails update(@PathVariable UUID id, @Valid @RequestBody FacilityRequest request) {
        return FacilityDetails.from(service.update(id, request.name().trim(), request.code().trim(), request.type(),
                request.address(), request.phone(), request.operatingHours()));
    }

    public record FacilityRequest(@NotBlank @Size(max = 200) String name,
            @NotBlank @Size(max = 20) String code, @NotNull FacilityType type,
            @Size(max = 300) String address, @Size(max = 20) String phone,
            @Size(max = 200) String operatingHours) {}

    public record FacilityDetails(UUID id, String name, String code, FacilityType type, String address,
                                  String phone, String operatingHours, boolean active) {
        static FacilityDetails from(Facility facility) {
            return new FacilityDetails(facility.getId(), facility.getName(), facility.getCode(), facility.getType(),
                    facility.getAddress(), facility.getPhone(), facility.getOperatingHours(), facility.isActive());
        }
    }
}
