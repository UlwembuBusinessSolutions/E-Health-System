package co.ehealth.platform.identity;

import co.ehealth.platform.core.security.AuthenticatedPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Returns only the logged-in clinician's own profile defaults for clinical forms. */
@RestController
public class ClinicianProfileController {
    private final UserRepository userRepository;

    public ClinicianProfileController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/api/v1/clinicians/me/profile")
    public ResponseEntity<ClinicianProfileResponse> getMyProfile(
            @AuthenticationPrincipal AuthenticatedPrincipal principal) {
        User user = userRepository.findById(principal.userId()).orElseThrow();
        return ResponseEntity.ok(new ClinicianProfileResponse(user.getId(), user.getFirstName(), user.getLastName(),
                user.getSancNumber(), user.getHpcsaNumber()));
    }

    public record ClinicianProfileResponse(UUID id, String firstName, String lastName,
            String sancNumber, String hpcsaNumber) {}
}
