// package co.ehealth.platform.facility;

// import co.ehealth.platform.identity.DuplicateFieldException;
// import org.springframework.stereotype.Service;

// import java.util.List;
// import java.util.UUID;

// // Started minimal — full Facility CRUD was deferred to Backend 1 per the
// // Phase 1 dev brief's ownership split, and this slice originally only
// // needed create() so a freshly provisioned tenant wasn't stuck unable to
// // onboard staff (staff creation requires a facilityId). SADM-US-006 (Add a
// // clinic to a tenant) is the first real facility-management story to land
// // here; suspend/remove (SADM-US-007/008) still aren't built.
// @Service
// public class FacilityService {

//     private final FacilityRepository facilityRepository;

//     public FacilityService(FacilityRepository facilityRepository) {
//         this.facilityRepository = facilityRepository;
//     }

//     // Pre-checked, not left to the table's own UNIQUE constraint, same
//     // "friendly 409 over a bare constraint-violation 500" reasoning as
//     // patient idNumber and organization slug — DataIntegrityViolationException
//     // is still there as the race-condition backstop (GlobalExceptionHandler's
//     // own why-note on that handler), not the primary path.
//     public Facility create(String name, String code, FacilityType type, String address, String phone,
//                             String operatingHours) {
//         if (facilityRepository.existsByCode(code)) {
//             throw new DuplicateFieldException("code", "A clinic with this code already exists.");
//         }
//         Facility facility = new Facility(name, code, type);
//         facility.setAddress(address);
//         facility.setPhone(phone);
//         facility.setOperatingHours(operatingHours);
//         return facilityRepository.save(facility);
//     }

//     // visit.VisitService's own read — the module-boundary rule ("no module
//     // calls another module's repository directly, only its service") means
//     // a visit can't validate its own facilityId by querying
//     // FacilityRepository itself.
//     public Facility get(UUID id) {
//         return facilityRepository.findById(id).orElseThrow(FacilityNotFoundException::new);
//     }

//     // SADM-US-006's read half, for the platform console's clinic list —
//     // includes inactive facilities deliberately (unlike GET
//     // /api/v1/facilities, which is the tenant-side staff-creation dropdown
//     // and has no reason to offer a clinic nobody can be assigned to
//     // anymore). A platform operator managing a tenant's facility network
//     // needs to see the whole thing, not just what's currently assignable.
//     public List<Facility> list() {
//         return facilityRepository.findAll();
//     }
// }

package co.ehealth.platform.facility;

import co.ehealth.platform.core.tenant.ModuleCode;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.platform.TenantModuleNotEnabledException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

// Started minimal — full Facility CRUD was deferred to Backend 1 per the
// Phase 1 dev brief's ownership split, and this slice originally only
// needed create() so a freshly provisioned tenant wasn't stuck unable to
// onboard staff (staff creation requires a facilityId). SADM-US-006 (Add a
// clinic to a tenant) is the first real facility-management story to land
// here; suspend/remove (SADM-US-007/008) still aren't built.
@Service
public class FacilityService {

    private final FacilityRepository facilityRepository;
    private final FacilityModuleEntitlementRepository facilityModuleEntitlementRepository;

    public FacilityService(FacilityRepository facilityRepository,
            FacilityModuleEntitlementRepository facilityModuleEntitlementRepository) {
        this.facilityRepository = facilityRepository;
        this.facilityModuleEntitlementRepository = facilityModuleEntitlementRepository;
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

    // SADM-US-011 / BR-SADM-060 — the full 20-module picture for one
    // clinic. A module with no override row here reads as whatever the
    // tenant currently has switched on (tenantEnabledByCode, passed in by
    // the caller — this service has no path to control.module_entitlements
    // itself, that's OrganizationProvisioningService's job to resolve and
    // hand down, same module-boundary rule as everywhere else). Foundation
    // modules are always on and never overridable, same floor as the
    // tenant-level view.
    public List<FacilityModuleEntitlementView> listModuleEntitlements(
            UUID facilityId, Map<ModuleCode, Boolean> tenantEnabledByCode) {
        get(facilityId); // 404s on an unknown facility before anything else runs

        Map<ModuleCode, FacilityModuleEntitlement> overridesByCode = facilityModuleEntitlementRepository
                .findByFacilityId(facilityId).stream()
                .collect(Collectors.toMap(FacilityModuleEntitlement::getModuleCode, e -> e));

        return Arrays.stream(ModuleCode.values())
                .map(code -> {
                    if (code.isFoundation()) {
                        return new FacilityModuleEntitlementView(code, code.getDisplayName(), code.getPhase(),
                                true, true, true, false);
                    }
                    boolean tenantEnabled = tenantEnabledByCode.getOrDefault(code, false);
                    FacilityModuleEntitlement override = overridesByCode.get(code);
                    boolean enabled = tenantEnabled && (override == null || override.isEnabled());
                    return new FacilityModuleEntitlementView(code, code.getDisplayName(), code.getPhase(),
                            false, tenantEnabled, enabled, override != null);
                })
                .toList();
    }

    // The write half. tenantLevelEnabled is resolved and passed in by the
    // caller (OrganizationProvisioningService, which alone has both the
    // control-schema entitlement and this tenant's schema in scope for one
    // call) — this method enforces the rule, it doesn't independently look
    // the tenant state up a second time.
    @Transactional
    public void setModuleOverride(UUID facilityId, ModuleCode moduleCode, boolean enabled,
            boolean tenantLevelEnabled) {
        if (moduleCode.isFoundation()) {
            throw new co.ehealth.platform.platform.FoundationModuleException(moduleCode);
        }
        get(facilityId); // 404s on an unknown facility

        // BR-SADM-060 AC2: a clinic can never unlock a module its own
        // tenant hasn't switched on. Disabling is always allowed regardless
        // of tenant state — the tenant-level check only gates turning ON.
        if (enabled && !tenantLevelEnabled) {
            throw new TenantModuleNotEnabledException(moduleCode);
        }

        FacilityModuleEntitlement entitlement = facilityModuleEntitlementRepository
                .findByFacilityIdAndModuleCode(facilityId, moduleCode)
                .orElseGet(() -> new FacilityModuleEntitlement(facilityId, moduleCode, true));
        entitlement.setEnabled(enabled);
        facilityModuleEntitlementRepository.save(entitlement);
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