package co.ehealth.platform.facility;

import org.springframework.stereotype.Service;

// Minimal on purpose — full Facility CRUD (edit, deactivate, timezone
// changes) belongs to Backend 1 per the Phase 1 dev brief's ownership
// split and isn't built here. This is the one write this slice can't skip:
// a freshly provisioned tenant starts with zero facilities, and staff
// creation requires a facilityId — without a way to create at least one,
// a brand-new organization would be unable to onboard any staff at all.
@Service
public class FacilityService {

    private final FacilityRepository facilityRepository;

    public FacilityService(FacilityRepository facilityRepository) {
        this.facilityRepository = facilityRepository;
    }

    public Facility create(String name, String code, FacilityType type, String address, String phone) {
        Facility facility = new Facility(name, code, type);
        facility.setAddress(address);
        facility.setPhone(phone);
        return facilityRepository.save(facility);
    }
}
