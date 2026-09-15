package co.ehealth.platform.core.security;

import co.ehealth.platform.core.audit.AuditLogService;
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
            AuditLogService auditLogService,
            PlatformJwtService platformJwtService, PlatformOperatorRepository platformOperatorRepository,
            SessionActivityStore activityStore, Clock clock,
            @Value("${app.idle-lock.timeout-minutes}") long idleTimeoutMinutes,
            CorsConfigurationSource corsConfigurationSource) throws Exception {

        JwtAuthenticationFilter jwtFilter =
                new JwtAuthenticationFilter(jwtService, userRepository, auditLogService);

        IdleLockFilter idleLockFilter =
                new IdleLockFilter(activityStore, Duration.ofMinutes(idleTimeoutMinutes), clock);

        PlatformJwtAuthenticationFilter platformJwtFilter =
                new PlatformJwtAuthenticationFilter(platformJwtService, platformOperatorRepository);

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers(
                        "/api/v1/auth/login",
                        "/api/v1/auth/password-reset/**",
                        "/actuator/health"
                ).permitAll()

                .requestMatchers(
                        "/platform/auth/login",
                        "/platform/auth/register",
                        "/platform/auth/password-reset/**"
                ).permitAll()

                .requestMatchers("/api/v1/tenants/**")
                .hasRole("PLATFORM_OPERATOR")

                .requestMatchers("/platform/**")
                .hasRole("PLATFORM_OPERATOR")

                .requestMatchers("/api/v1/admin/**")
                .hasRole("ORG_ADMIN")

                .requestMatchers(HttpMethod.POST, "/api/v1/facilities")
                .hasRole("ORG_ADMIN")

                .requestMatchers(HttpMethod.PUT, "/api/v1/audit/**")
                .denyAll()

                .requestMatchers(HttpMethod.PATCH, "/api/v1/audit/**")
                .denyAll()

                .requestMatchers(HttpMethod.DELETE, "/api/v1/audit/**")
                .denyAll()

                .requestMatchers(HttpMethod.POST, "/api/v1/audit/**")
                .denyAll()

                .anyRequest()
                .authenticated()
            )
            .addFilterBefore(platformJwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterAfter(idleLockFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("#{'${app.cors.allowed-origins}'.split(',')}") List<String> allowedOrigins) {

        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(allowedOrigins);

        configuration.setAllowedMethods(
                List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        );

        configuration.setAllowedHeaders(
                List.of(
                        "Authorization",
                        "Content-Type",
                        "X-Tenant-ID",
                        "X-Platform-Key"
                )
        );

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}
