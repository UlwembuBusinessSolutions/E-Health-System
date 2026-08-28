package co.ehealth.platform.core.security;

import co.ehealth.platform.identity.UserRepository;
import co.ehealth.platform.platform.PlatformOperatorRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.time.Clock;
import java.time.Duration;
import java.util.List;

@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder(@Value("${app.security.bcrypt-strength}") int strength) {
        return new BCryptPasswordEncoder(strength);
    }

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http, JwtService jwtService, UserRepository userRepository,
            PlatformJwtService platformJwtService, PlatformOperatorRepository platformOperatorRepository,
            SessionActivityStore activityStore, Clock clock,
            @Value("${app.idle-lock.timeout-minutes}") long idleTimeoutMinutes,
            CorsConfigurationSource corsConfigurationSource) throws Exception {

        JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtService, userRepository);
        IdleLockFilter idleLockFilter =
                new IdleLockFilter(activityStore, Duration.ofMinutes(idleTimeoutMinutes), clock);
        PlatformJwtAuthenticationFilter platformJwtFilter =
                new PlatformJwtAuthenticationFilter(platformJwtService, platformOperatorRepository);

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable) // stateless bearer-token API — no cookie session to forge
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/api/v1/auth/login", "/api/v1/auth/password-reset/**",
                        "/actuator/health").permitAll()
                // Getting a token in the first place can't require one.
                .requestMatchers("/platform/auth/login").permitAll()
                // SADM-US-005's register is deliberately under /api/v1 for
                // the console contract, but remains platform-scoped rather
                // than tenant-scoped.
                .requestMatchers("/api/v1/tenants/**").hasRole("PLATFORM_OPERATOR")
                // Everything else under /platform/** needs a real,
                // ACTIVE, correctly-signed operator token — PlatformJwtAuthenticationFilter
                // is what actually populates that Authentication; this
                // just says what it has to look like once it's there.
                .requestMatchers("/platform/**").hasRole("PLATFORM_OPERATOR")
                .requestMatchers("/api/v1/admin/**").hasRole("ORG_ADMIN")
                // Creating a facility is an admin action even though the
                // path isn't under /api/v1/admin/** — GET on the same path
                // has to stay open to any authenticated staff member (it
                // feeds the staff-creation dropdown), so the two verbs
                // need separate rules rather than one path-level match.
                .requestMatchers(HttpMethod.POST, "/api/v1/facilities").hasRole("ORG_ADMIN")
                // /api/v1/facilities (GET) and /api/v1/roles feed the admin
                // staff-creation dropdowns and nothing else — the original
                // Phase 1 spec lists their minimum role as "any", meaning
                // any authenticated staff member, not the public internet.
                // Both only have real callers behind RequireAuth already,
                // so requiring a valid tenant JWT costs nothing functional
                // and closes an unnecessary public-data exposure.
                .anyRequest().authenticated())
            .addFilterBefore(platformJwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(idleLockFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("#{'${app.cors.allowed-origins}'.split(',')}") List<String> allowedOrigins) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins); // explicit per-environment list, not "*"
        // PATCH added for PlatformController.updateDetails() — the first
        // genuinely RESTful "edit this resource" endpoint in the app;
        // without it here, a real browser's preflight for that call would
        // reject PATCH before the request ever reached the filter chain.
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
        // X-Platform-Key listed alongside the tenant headers — a header not
        // listed here gets stripped by the browser's CORS preflight before
        // it ever reaches PlatformJwtAuthenticationFilter, which would look
        // identical to a missing token from the server's side.
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Tenant-ID", "X-Platform-Key"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
