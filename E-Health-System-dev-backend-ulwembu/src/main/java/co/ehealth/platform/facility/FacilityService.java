package co.ehealth.platform.facility;

import co.ehealth.platform.identity.DuplicateFieldException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

// Started minimal — full Facility CRUD was deferred to Backend 1 per the
// Phase 1 dev brief's ownership split, and this slice originally only
// needed create() so a freshly provisioned tenant wasn't stuck unable to
// onboard staff (staff creation requires a facilityId). SADM-US-006 (Add a
// clinic to a tenant) is the first real facility-management story to land
// here; suspend/remove (SADM-US-007/008) still aren't built.
@Service
public class FacilityService {

    private final FacilityRepository facilityRepository;

    public FacilityService(FacilityRepository facilityRepository) {
        this.facilityRepository = facilityRepository;
    }

    // Pre-checked, not left to the table's own UNIQUE constraint, same
    // "friendly 409 over a bare constraint-violation 500" reasoning as
    // patient idNumber and organization slug — DataIntegrityViolationException
    // is still there as the race-condition backstop (GlobalExceptionHandler's
    // own why-note on that handler), not the primary path.
    public Facility create(String name, String code, FacilityType type, String address, String phone,
                            String operatingHours) {
        if (facilityRepository.existsByCode(code)) {
            throw new DuplicateFieldException("code", "A clinic with this code already exists.");
        }
        Facility facility = new Facility(name, code, type);
        facility.setAddress(address);
        facility.setPhone(phone);
        facility.setOperatingHours(operatingHours);
        return facilityRepository.save(facility);
    }

    // visit.VisitService's own read — the module-boundary rule ("no module
    // calls another module's repository directly, only its service") means
    // a visit can't validate its own facilityId by querying
    // FacilityRepository itself.
    public Facility get(UUID id) {
        return facilityRepository.findById(id).orElseThrow(FacilityNotFoundException::new);
    }

    // SADM-US-006's read half, for the platform console's clinic list —
    // includes inactive facilities deliberately (unlike GET
    // /api/v1/facilities, which is the tenant-side staff-creation dropdown
    // and has no reason to offer a clinic nobody can be assigned to
    // anymore). A platform operator managing a tenant's facility network
    // needs to see the whole thing, not just what's currently assignable.
    public List<Facility> list() {
        return facilityRepository.findAll();
    }
}
