package co.ehealth.platform.pharmacy.ccmdd;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.PermissionLevel;
import co.ehealth.platform.identity.PermissionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.ResponseEntity;
import java.util.*;

/** EP-10 PHRM / PHRM-F03: authenticated, tenant-scoped CCMDD operations. */
@RestController
@RequestMapping("/api/v1/pharmacy/ccmdd")
public class CcmddController {
    private final CcmddDirectoryService directory;
    private final CcmddParcelService parcels;
    private final PermissionService permissions;

    public CcmddController(CcmddDirectoryService directory, CcmddParcelService parcels,
                           PermissionService permissions) {
        this.directory = directory; this.parcels = parcels; this.permissions = permissions;
    }
    @GetMapping("/pickup-points")
    public CcmddDirectoryService.DirectoryResult pickupPoints(@RequestParam(defaultValue="") String q,
            @RequestParam(defaultValue="") String province, @RequestParam(defaultValue="") String district,
            @RequestParam(defaultValue="") String area) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return directory.search(q, province, district, area, false);
    }
    @PostMapping("/pickup-points/refresh")
    public CcmddDirectoryService.DirectoryResult refresh(@RequestParam(defaultValue="") String q,
            @RequestParam(defaultValue="") String province, @RequestParam(defaultValue="") String district,
            @RequestParam(defaultValue="") String area) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return directory.search(q, province, district, area, true);
    }
    @GetMapping("/parcels")
    public List<CcmddParcelService.ParcelView> parcelList(@RequestParam UUID facilityId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return parcels.list(facilityId, false);
    }
    @GetMapping("/tracing")
    public List<CcmddParcelService.ParcelView> tracing(@RequestParam UUID facilityId) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return parcels.list(facilityId, true);
    }
    @GetMapping("/config")
    public Map<String, Integer> config() {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.VIEW);
        return Map.of("tracingDays", parcels.defaultTracingDays());
    }
    @PostMapping("/parcels")
    public CcmddParcelService.ParcelView dispatch(@Valid @RequestBody Dispatch request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return parcels.dispatch(request.facilityId(), request.prescriptionSerial(), request.pickupPointId(),
                request.tracingDays(), staff.userId());
    }
    @PatchMapping("/parcels/{id}/status")
    public CcmddParcelService.ParcelView status(@PathVariable UUID id, @Valid @RequestBody Status request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return parcels.updateStatus(id, request.facilityId(), request.status(), staff.userId());
    }
    @PostMapping("/parcels/{id}/trace")
    public CcmddParcelService.ParcelView trace(@PathVariable UUID id, @Valid @RequestBody Trace request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return parcels.recordTrace(id, request.facilityId(), request.note(), staff.userId());
    }
    @PostMapping("/parcels/{id}/notify")
    public CcmddParcelService.ParcelView notifyAgain(@PathVariable UUID id, @Valid @RequestBody Facility request,
            @AuthenticationPrincipal AuthenticatedPrincipal staff) {
        permissions.requireAccess(ModuleCode.PHRM, PermissionLevel.MANAGE);
        return parcels.retryNotification(id, request.facilityId(), staff.userId());
    }
    // Preserve the project's {message} error contract for business-state conflicts.
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> workflowError(ResponseStatusException error) {
        return ResponseEntity.status(error.getStatusCode())
                .body(Map.of("message", error.getReason() == null ? "CCMDD request rejected" : error.getReason()));
    }
    public record Dispatch(@NotNull UUID facilityId, @NotBlank String prescriptionSerial,
                           @NotNull UUID pickupPointId, @Min(1) @Max(90) Integer tracingDays) {}
    public record Status(@NotNull UUID facilityId, @NotBlank String status) {}
    public record Trace(@NotNull UUID facilityId, @NotBlank @Size(max=1000) String note) {}
    public record Facility(@NotNull UUID facilityId) {}
}
