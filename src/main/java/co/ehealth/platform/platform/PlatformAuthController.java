package co.ehealth.platform.platform;

import co.ehealth.platform.core.security.PlatformJwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/platform/auth")
public class PlatformAuthController {

    private final PlatformAuthService platformAuthService;
    private final PlatformOperatorRepository platformOperatorRepository;

    public PlatformAuthController(PlatformAuthService platformAuthService,
                                   PlatformOperatorRepository platformOperatorRepository) {
        this.platformAuthService = platformAuthService;
        this.platformOperatorRepository = platformOperatorRepository;
    }

    // Same shape as identity.AuthController.login(): issue the token, then
    // a separate lookup to build the summary the frontend actually wants
    // ("Signed in as ___"), rather than widening PlatformAuthService.login()'s
    // return type to carry it.
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        PlatformJwtService.IssuedToken issued = platformAuthService.login(request.email(), request.password());
        PlatformOperator operator = platformOperatorRepository.findByEmail(request.email()).orElseThrow();
        return ResponseEntity.ok(new LoginResponse(issued.token(), issued.expiresAt().toString(),
                new OperatorSummary(operator.getId(), operator.getEmail(), operator.getFirstName(),
                        operator.getLastName())));
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    public record LoginResponse(String accessToken, String expiresAt, OperatorSummary operator) {
    }

    public record OperatorSummary(UUID id, String email, String firstName, String lastName) {
    }
}
