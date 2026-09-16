package co.ehealth.platform.core.security;

import java.util.UUID;

public record PatientPrincipal(UUID patientAccountId, String jti) {
}
