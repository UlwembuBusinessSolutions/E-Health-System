package co.ehealth.platform.core.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

// A third signing key, separate from both JwtService's (staff) and
// PlatformJwtService's — same reasoning as the split between those two: a
// compromised patient-token secret shouldn't grant staff or platform
// access, and vice versa. Unlike PlatformJwtService, DOES carry a tenant
// claim (a patient is scoped to one tenant, same as staff) — checked by
// PatientJwtAuthenticationFilter the same way JwtAuthenticationFilter
// checks it for staff tokens. No roles claim: a valid patient token means
// exactly one thing (ROLE_PATIENT), nothing to enumerate.
@Service
public class PatientJwtService {

    private final SecretKey signingKey;
    private final Duration accessTokenTtl;
    private final Clock clock;

    public PatientJwtService(@Value("${app.patient.jwt-secret}") String secret,
                              @Value("${app.patient.access-token-ttl-minutes}") long accessTokenTtlMinutes,
                              Clock clock) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
        this.accessTokenTtl = Duration.ofMinutes(accessTokenTtlMinutes);
        this.clock = clock;
    }

    public IssuedToken issue(UUID patientAccountId, String tenantSchema, int tokenVersion) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(accessTokenTtl);
        String jti = UUID.randomUUID().toString();

        String token = Jwts.builder()
                .id(jti)
                .subject(patientAccountId.toString())
                .claim("tenant", tenantSchema)
                .claim("tokenVersion", tokenVersion)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey)
                .compact();

        return new IssuedToken(token, jti, expiresAt);
    }

    public Claims parseAndValidate(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(signingKey)
                    .clock(() -> Date.from(clock.instant()))
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException("Token is invalid or expired", e);
        }
    }

    public record IssuedToken(String token, String jti, Instant expiresAt) {
    }
}
