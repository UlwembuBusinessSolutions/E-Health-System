package co.ehealth.platform.patient;

import co.ehealth.platform.core.tenant.Organization;
import co.ehealth.platform.core.tenant.OrganizationRepository;
import co.ehealth.platform.core.tenant.OrganizationStatus;
import co.ehealth.platform.core.tenant.TenantContext;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityService;
import co.ehealth.platform.facility.FacilityType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReferralDestinationServiceTest {

    private final OrganizationRepository organizationRepository = mock(OrganizationRepository.class);
    private final FacilityService facilityService = mock(FacilityService.class);
    private final ReferralDestinationService service =
            new ReferralDestinationService(organizationRepository, facilityService);

    @AfterEach
    void clearTenantContext() {
        TenantContext.clear();
    }

    @Test
    void listsActiveClinicalFacilitiesAcrossOrganizationsAndRestoresOriginTenant() {
        TenantContext.setCurrentTenant("origin");
        Organization north = organization("north", "North Health");
        Organization south = organization("south", "South Health");
        Facility northClinic = facility("North Clinic", FacilityType.CLINIC, true);
        Facility northStore = facility("North Store", FacilityType.STORE, true);
        Facility southHospital = facility("South Hospital", FacilityType.HOSPITAL, true);
        Facility inactiveClinic = facility("Closed Clinic", FacilityType.CLINIC, false);

        when(organizationRepository.findByStatusOrderByDisplayNameAsc(OrganizationStatus.ACTIVE))
                .thenReturn(List.of(north, south));
        when(facilityService.list()).thenAnswer(invocation -> switch (TenantContext.getCurrentTenant()) {
            case "north" -> List.of(northClinic, northStore);
            case "south" -> List.of(southHospital, inactiveClinic);
            default -> List.of();
        });

        List<PatientReferralService.ReferralDestination> destinations = service.listActiveDestinations();

        assertEquals(List.of(northClinic.getId(), southHospital.getId()),
                destinations.stream().map(PatientReferralService.ReferralDestination::facilityId).toList());
        assertEquals(List.of("North Health", "South Health"),
                destinations.stream().map(PatientReferralService.ReferralDestination::organizationName).toList());
        assertEquals("origin", TenantContext.getCurrentTenant());
    }

    private Organization organization(String schema, String displayName) {
        Organization organization = mock(Organization.class);
        when(organization.getSchemaName()).thenReturn(schema);
        when(organization.getDisplayName()).thenReturn(displayName);
        when(organization.getId()).thenReturn(UUID.randomUUID());
        return organization;
    }

    private Facility facility(String name, FacilityType type, boolean active) {
        Facility facility = mock(Facility.class);
        when(facility.getId()).thenReturn(UUID.randomUUID());
        when(facility.getName()).thenReturn(name);
        when(facility.getType()).thenReturn(type);
        when(facility.isActive()).thenReturn(active);
        return facility;
    }
}
