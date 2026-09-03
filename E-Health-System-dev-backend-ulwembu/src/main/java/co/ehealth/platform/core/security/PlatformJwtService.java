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

// A separate signing key from JwtService's tenant tokens (app.platform.jwt-secret,
// not app.jwt.secret) — deliberately: a compromised tenant JWT secret
// shouldn't grant platform access, and vice versa. No tenant claim (nothing
// to check it against — a platform operator isn't scoped to one) and no
// roles claim (there's exactly one thing a valid platform token means: this
// is a platform operator).
@Service
public class PlatformJwtService {

    private final SecretKey signingKey;
    private final Duration accessTokenTtl;
    private final Clock clock;

    public PlatformJwtService(@Value("${app.platform.jwt-secret}") String secret,
                               @Value("${app.platform.access-token-ttl-minutes}") long accessTokenTtlMinutes,
                               Clock clock) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
        this.accessTokenTtl = Duration.ofMinutes(accessTokenTtlMinutes);
        this.clock = clock;
    }

    public IssuedToken issue(UUID operatorId, int tokenVersion) {
        Instant now = clock.instant();
        Instant expiresAt = now.plus(accessTokenTtl);
        String jti = UUID.randomUUID().toString();

        String token = Jwts.builder()
                .id(jti)
                .subject(operatorId.toString())
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
