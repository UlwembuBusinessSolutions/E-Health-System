package co.ehealth.platform.core.security;

import java.util.UUID;

public record PlatformOperatorPrincipal(UUID operatorId, String jti) {
}
