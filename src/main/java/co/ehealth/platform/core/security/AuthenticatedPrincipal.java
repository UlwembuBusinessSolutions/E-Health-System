package co.ehealth.platform.core.security;

import java.util.UUID;

public record AuthenticatedPrincipal(UUID userId, String jti) {
}
