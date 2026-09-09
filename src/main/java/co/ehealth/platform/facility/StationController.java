package co.ehealth.platform.facility;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class StationController {

    private final StationService stationService;

    public StationController(StationService stationService) {
        this.stationService = stationService;
    }

    @GetMapping("/stations/{stationId}")
    public Map<String, Object> get(@PathVariable UUID stationId) {
        Station station = stationService.get(stationId);
        return Map.of(
                "id", station.getId(),
                "name", station.getName(),
                "code", station.getCode(),
                "careService", station.getCareService(),
                "facilityId", station.getFacility().getId()
        );
    }

    @PostMapping("/facilities/{facilityId}/stations")
    public Map<String, Object> create(@PathVariable UUID facilityId, @RequestBody Map<String, String> payload) {
        String name = payload.get("name");
        String code = payload.get("code");
        String serviceValue = payload.get("careService");
        CareService careService;
        try {
            careService = serviceValue == null ? null : CareService.valueOf(serviceValue.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("careService must be MEDICAL, SURGICAL, DIAGNOSTIC, or LONG_TERM_CARE.");
        }
        Station station = stationService.create(facilityId, name, code, careService);
        return Map.of(
                "id", station.getId(),
                "name", station.getName(),
                "code", station.getCode(),
                "careService", station.getCareService(),
                "facilityId", station.getFacility().getId()
        );
    }
}
