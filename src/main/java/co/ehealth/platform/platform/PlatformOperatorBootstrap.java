package co.ehealth.platform.platform;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

// The gap this codebase has always been honest about: control.platform_operators
// has no self-registration and no admin-creates-admin path the way tenants
// do — a brand-new deployment has zero platform operators by definition,
// and the very first one has to come from somewhere. This is that
// somewhere, for local/dev only (see @Profile below) — creates exactly one
// operator from environment variables if none exists yet. A production
// deployment needs a deliberate, audited equivalent (a one-off script run
// once at deploy time, not a runner that fires on every boot check) — not
// built here.
// @Order(1) — must run after core.tenant.StartupMigrations (@Order(0)),
// which is what actually creates control.platform_operators. Spring Boot
// doesn't otherwise guarantee ApplicationRunner ordering across beans.
@Component
@Profile("dev")
@Order(1)
public class PlatformOperatorBootstrap implements ApplicationRunner {

    private final PlatformOperatorRepository platformOperatorRepository;
    private final PasswordEncoder passwordEncoder;
    private final String bootstrapEmail;
    private final String bootstrapPassword;
    private final String bootstrapFirstName;
    private final String bootstrapLastName;

    public PlatformOperatorBootstrap(PlatformOperatorRepository platformOperatorRepository,
                                      PasswordEncoder passwordEncoder,
                                      @Value("${app.platform.bootstrap.email}") String bootstrapEmail,
                                      @Value("${app.platform.bootstrap.password}") String bootstrapPassword,
                                      @Value("${app.platform.bootstrap.first-name}") String bootstrapFirstName,
                                      @Value("${app.platform.bootstrap.last-name}") String bootstrapLastName) {
        this.platformOperatorRepository = platformOperatorRepository;
        this.passwordEncoder = passwordEncoder;
        this.bootstrapEmail = bootstrapEmail;
        this.bootstrapPassword = bootstrapPassword;
        this.bootstrapFirstName = bootstrapFirstName;
        this.bootstrapLastName = bootstrapLastName;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (platformOperatorRepository.existsByEmail(bootstrapEmail)) {
            return;
        }
        PlatformOperator operator = new PlatformOperator(
                bootstrapEmail, bootstrapFirstName, bootstrapLastName, passwordEncoder.encode(bootstrapPassword));
        platformOperatorRepository.save(operator);
    }
}
