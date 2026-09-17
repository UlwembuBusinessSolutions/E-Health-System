package co.ehealth.platform.facility;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/facilities/{facilityId}/configuration")
public class ClinicConfigurationController {
    private final ClinicConfigurationService service;
    public ClinicConfigurationController(ClinicConfigurationService service) { this.service=service; }
    @GetMapping("/departments") public Map<String,Object> departments(@PathVariable UUID facilityId) { return Map.of("items", service.departments(facilityId).stream().map(d -> new DepartmentResponse(d.getId(),d.getFacilityId(),d.getName())).toList()); }
    @PostMapping("/departments") public ResponseEntity<DepartmentResponse> addDepartment(@PathVariable UUID facilityId,@Valid @RequestBody DepartmentRequest r) { Department d=service.addDepartment(facilityId,r.name()); return ResponseEntity.status(201).body(new DepartmentResponse(d.getId(),d.getFacilityId(),d.getName())); }
    @DeleteMapping("/departments/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deleteDepartment(@PathVariable UUID facilityId,@PathVariable UUID id) { service.deleteDepartment(facilityId,id); }
    @GetMapping("/stations") public Map<String,Object> stations(@PathVariable UUID facilityId) { return Map.of("items", service.stations(facilityId).stream().map(this::station).toList()); }
    @PostMapping("/stations") public ResponseEntity<StationResponse> addStation(@PathVariable UUID facilityId,@Valid @RequestBody StationRequest r) { return ResponseEntity.status(201).body(station(service.addStation(facilityId,r.departmentId(),r.name(),r.counterLabel()))); }
    @DeleteMapping("/stations/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deleteStation(@PathVariable UUID facilityId,@PathVariable UUID id) { service.deleteStation(facilityId,id); }
    private StationResponse station(ServiceStation s) { return new StationResponse(s.getId(),s.getFacilityId(),s.getDepartmentId(),s.getName(),s.getCounterLabel()); }
    public record DepartmentRequest(@NotBlank @Size(max=200) String name) {}
    public record StationRequest(UUID departmentId,@NotBlank @Size(max=200) String name,@Size(max=100) String counterLabel) {}
    public record DepartmentResponse(UUID id,UUID facilityId,String name) {}
    public record StationResponse(UUID id,UUID facilityId,UUID departmentId,String name,String counterLabel) {}
}
