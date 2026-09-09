package co.ehealth.platform.facility;

import co.ehealth.platform.identity.DuplicateFieldException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class StationService {

    private final StationRepository stationRepository;
    private final FacilityService facilityService;

    public StationService(StationRepository stationRepository, FacilityService facilityService) {
        this.stationRepository = stationRepository;
        this.facilityService = facilityService;
    }

    public Station create(UUID facilityId, String name, String code, CareService careService) {
        Facility facility = facilityService.get(facilityId);
        if (facility.getType() == FacilityType.STORE) {
            throw new IllegalArgumentException("Stations can only be created for clinics or hospitals.");
        }
        if (stationRepository.existsByFacilityIdAndCode(facilityId, code)) {
            throw new DuplicateFieldException("code", "A station with this code already exists in this facility.");
        }
        if (careService == null) {
            throw new IllegalArgumentException("careService is required.");
        }
        return stationRepository.save(new Station(facility, name, code, careService));
    }

    public Station create(UUID facilityId, String name, String code) {
        return create(facilityId, name, code, CareService.MEDICAL);
    }

    public List<Station> listByFacility(UUID facilityId) {
        return stationRepository.findByFacilityIdAndActiveTrue(facilityId);
    }

    public Station get(UUID stationId) {
        return stationRepository.findById(stationId).orElseThrow(() -> new IllegalArgumentException("Unknown station"));
    }

    public Station getOperationalStation(UUID stationId) {
        Station station = get(stationId);
        if (!station.isActive() || station.getFacility().getType() == FacilityType.STORE) {
            throw new IllegalArgumentException("The target station must belong to an active clinic or hospital.");
        }
        return station;
    }
}
