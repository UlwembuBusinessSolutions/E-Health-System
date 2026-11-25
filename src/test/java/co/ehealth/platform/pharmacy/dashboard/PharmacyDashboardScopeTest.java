package co.ehealth.platform.pharmacy.dashboard;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class PharmacyDashboardScopeTest {

    private final UserRepository userRepository = mock(UserRepository.class);
    private final FacilityRepository facilityRepository = mock(FacilityRepository.class);
    private final PharmacyDashboardScope scope = new PharmacyDashboardScope(userRepository, facilityRepository);

    @AfterEach
    void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void checksRequestedClinicAgainstAuthenticatedUsersAssignments() {
        UUID userId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(userId, "session"), null));
        when(userRepository.isAssignedToFacility(userId, facilityId)).thenReturn(true);

        scope.requireFacility(facilityId);

        verify(userRepository).isAssignedToFacility(userId, facilityId);
    }

    @Test
    void deniesClinicNotAssignedToAuthenticatedUser() {
        UUID userId = UUID.randomUUID();
        UUID facilityId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(userId, "session"), null));
        when(userRepository.isAssignedToFacility(userId, facilityId)).thenReturn(false);

        assertThrows(AccessDeniedException.class, () -> scope.requireFacility(facilityId));
    }

    @Test
    void clinicSelectorIncludesOnlyAssignedActiveClinics() {
        UUID userId = UUID.randomUUID();
        UUID activeId = UUID.randomUUID();
        UUID inactiveId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new AuthenticatedPrincipal(userId, "session"), null));
        Facility active = mock(Facility.class);
        when(active.getId()).thenReturn(activeId);
        when(active.getName()).thenReturn("Active Clinic");
        when(active.isActive()).thenReturn(true);
        Facility inactive = mock(Facility.class);
        when(inactive.isActive()).thenReturn(false);
        when(userRepository.findFacilityIdsByUserId(userId)).thenReturn(List.of(activeId, inactiveId));
        when(facilityRepository.findAllById(List.of(activeId, inactiveId))).thenReturn(List.of(active, inactive));

        assertEquals(List.of(new PharmacyDashboardScope.Clinic(activeId, "Active Clinic")), scope.clinics());
    }
}