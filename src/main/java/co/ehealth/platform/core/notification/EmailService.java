package co.ehealth.platform.core.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.format.DateTimeFormatter;

// One method per notification this system actually sends, not a generic
// send(to, subject, body) every caller composes by hand — keeps "what does
// this email say" in one place, same reasoning as AuditLogService being the
// one write path for audit rows rather than each caller building one itself.
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final DateTimeFormatter FILE_TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssSSS");

    private final EmailDeliveryWorker deliveryWorker;
    private final String fromAddress;
    private final String frontendBaseUrl;
    private final Path captureDir;
    private final Clock clock;

    public EmailService(EmailDeliveryWorker deliveryWorker,
                         @Value("${app.notifications.from-address}") String fromAddress,
                         @Value("${app.frontend.base-url}") String frontendBaseUrl,
                         @Value("${app.notifications.capture-dir}") String captureDir,
                         Clock clock) {
        this.deliveryWorker = deliveryWorker;
        this.fromAddress = fromAddress;
        this.frontendBaseUrl = frontendBaseUrl;
        this.captureDir = Path.of(captureDir);
        this.clock = clock;
    }

    // Fired once per admin account OrganizationProvisioningService creates
    // — "an admin has been approved," in this system's terms, means exactly
    // that: the platform team has created the account. There's no separate
    // approval queue anywhere in this design to notify about instead.
    //
    // Includes the temporary password and the organization slug directly —
    // the account has to be usable from this email alone (LoginScreen needs
    // all three: organization, email, password), and a login instruction
    // that omits the one thing the recipient doesn't already have isn't a
    // real instruction. This does mean anyone with access to the
    // recipient's inbox can sign in until they change it; accepted
    // trade-off for how this system is actually handed out today — revisit
    // if that stops being true.
    public void sendAdminAccountCreatedEmail(String toEmail, String firstName, String organizationDisplayName,
                                              String organizationSlug, String temporaryPassword) {
        String subject = "Your admin account is ready — " + organizationDisplayName;
        String body = """
                Hi %s,

                An administrator account has been created for you on %s.

                Sign in at %s/login with:
                  Organization: %s
                  Email: %s
                  Temporary password: %s

                You'll be asked to choose a new password the first time you sign in — this \
                temporary one stops working once you do.
                """.formatted(firstName, organizationDisplayName, frontendBaseUrl, organizationSlug, toEmail,
                temporaryPassword);
        send(toEmail, subject, body);
    }

    // Fired once per staff account StaffService.createStaff() creates —
    // previously nothing notified a regular staff member at all, only
    // org-admin accounts got an email. Same reasoning and same trade-off
    // as sendAdminAccountCreatedEmail's why-note above; employeeNumber is
    // included too since it's the identifier most of this system's paper
    // forms and internal references use, not just email.
    public void sendStaffAccountCreatedEmail(String toEmail, String firstName, String organizationDisplayName,
                                              String organizationSlug, String employeeNumber,
                                              String temporaryPassword) {
        String subject = "Your staff account is ready — " + organizationDisplayName;
        String body = """
                Hi %s,

                A staff account has been created for you on %s (employee number %s).

                Sign in at %s/login with:
                  Organization: %s
                  Email: %s
                  Temporary password: %s

                You'll be asked to choose a new password the first time you sign in — this \
                temporary one stops working once you do.
                """.formatted(firstName, organizationDisplayName, employeeNumber, frontendBaseUrl, organizationSlug,
                toEmail, temporaryPassword);
        send(toEmail, subject, body);
    }

    private void send(String toEmail, String subject, String body) {
        // Written synchronously, before this method returns — this is the
        // verifiable "what would this email have said" record (see the
        // why-note below), and it should exist immediately, not only after
        // a background delivery attempt eventually finishes or fails.
        captureToFile(toEmail, subject, body);
        // Everything past this point runs on a background thread
        // (EmailDeliveryWorker, EmailAsyncConfig's emailTaskExecutor) — this
        // call returns immediately regardless of how long the SMTP
        // attempt(s) take. Previously this sent inline: a slow (not even
        // down, just slow) mail server could add real latency to whatever
        // request triggered the email, and under enough concurrent load,
        // enough requests blocked on mail I/O at once could start starving
        // the app's own request-handling thread pool — the same failure
        // mode this split exists to remove.
        deliveryWorker.deliver(toEmail, subject, body);
    }

    // Local-dev/testing aid: every outbound email is written to disk BEFORE
    // the real send is attempted, and regardless of whether that send
    // succeeds — there's no real SMTP server configured yet in this
    // environment, so this is the only way to actually verify what an
    // email would have said. Not gated behind a profile check on purpose:
    // a real deployment would either point app.notifications.capture-dir
    // somewhere it doesn't matter, or this method would be revisited
    // before going to production with real patient-adjacent traffic.
    private void captureToFile(String toEmail, String subject, String body) {
        try {
            Files.createDirectories(captureDir);
            String filename = "%s__%s.txt".formatted(
                    FILE_TIMESTAMP.format(clock.instant().atZone(java.time.ZoneOffset.UTC)),
                    toEmail.replaceAll("[^a-zA-Z0-9.@-]", "_"));
            String content = "To: %s\nFrom: %s\nSubject: %s\n\n%s".formatted(toEmail, fromAddress, subject, body);
            Files.writeString(captureDir.resolve(filename), content, StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.warn("Failed to capture outbound email to disk for {}", toEmail, e);
        }
    }
}
