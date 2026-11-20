package co.ehealth.platform.patient;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.facility.FacilityType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class ReferralDestinationService {

    private final OrganizationRepository organizationRepository;
    private final FacilityService facilityService;

    public ReferralDestinationService(OrganizationRepository organizationRepository, FacilityService facilityService) {
        this.organizationRepository = organizationRepository;
        this.facilityService = facilityService;
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public List<PatientReferralService.ReferralDestination> listActiveDestinations() {
        String originSchema = TenantContext.getCurrentTenant();
        if (originSchema == null || originSchema.isBlank()) {
            throw new IllegalStateException("Cannot list referral destinations outside a tenant request.");
        }

        List<PatientReferralService.ReferralDestination> destinations = new ArrayList<>();
        try {
            for (Organization organization :
                    organizationRepository.findByStatusOrderByDisplayNameAsc(OrganizationStatus.ACTIVE)) {
                TenantContext.setCurrentTenant(organization.getSchemaName());
                for (Facility facility : facilityService.list()) {
                    if (facility.isActive() && (facility.getType() == FacilityType.CLINIC
                            || facility.getType() == FacilityType.HOSPITAL)) {
                        destinations.add(new PatientReferralService.ReferralDestination(facility.getId(),
                                facility.getName(), facility.getType(), facility.getPhone(), organization.getId(),
                                organization.getDisplayName()));
                    }
                }
            }
        } finally {
            TenantContext.setCurrentTenant(originSchema);
        }
        destinations.sort(Comparator.comparing(PatientReferralService.ReferralDestination::organizationName)
                .thenComparing(PatientReferralService.ReferralDestination::facilityName));
        return destinations;
    }

    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public PatientReferralService.ReferralDestination getActiveDestination(UUID facilityId) {
        return listActiveDestinations().stream()
                .filter(destination -> destination.facilityId().equals(facilityId))
                .findFirst()
                .orElseThrow(() -> new InvalidPatientReferralException(
                        "The selected destination clinic is no longer active."));
    }
}
