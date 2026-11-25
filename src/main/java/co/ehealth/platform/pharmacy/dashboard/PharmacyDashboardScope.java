package co.ehealth.platform.pharmacy.dashboard;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import co.ehealth.platform.facility.Facility;
import co.ehealth.platform.facility.FacilityRepository;
import co.ehealth.platform.identity.UserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
public class PharmacyDashboardScope {

    private final UserRepository userRepository;
    private final FacilityRepository facilityRepository;

    public PharmacyDashboardScope(UserRepository userRepository, FacilityRepository facilityRepository) {
        this.userRepository = userRepository;
        this.facilityRepository = facilityRepository;
    }

    public void requireFacility(UUID facilityId) {
        if (!userRepository.isAssignedToFacility(currentUserId(), facilityId)) {
            throw new AccessDeniedException("You are not assigned to this clinic.");
        }
    }

    public List<Clinic> clinics() {
        List<UUID> facilityIds = userRepository.findFacilityIdsByUserId(currentUserId());
        return facilityRepository.findAllById(facilityIds).stream()
                .filter(Facility::isActive)
                .sorted(Comparator.comparing(Facility::getName, String.CASE_INSENSITIVE_ORDER))
                .map(facility -> new Clinic(facility.getId(), facility.getName()))
                .toList();
    }

    private static UUID currentUserId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedPrincipal principal)) {
            throw new AccessDeniedException("An authenticated clinic user is required.");
        }
        return principal.userId();
    }

    public record Clinic(UUID id, String name) {
    }
}