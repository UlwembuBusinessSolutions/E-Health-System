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

    // Fired once per staff account StaffService.createStaff() creates.
    // The setup code is a one-time credential, not a standing password: the
    // recipient chooses the real password before they can use the account.
    public void sendStaffAccountCreatedEmail(String toEmail, String firstName, String organizationDisplayName,
                                              String organizationSlug, String employeeNumber,
                                              String setupCode) {
        String subject = "Your staff account is ready — " + organizationDisplayName;
        String setupUrl = "%s/org/%s/set-password?email=%s&code=%s".formatted(
          frontendBaseUrl.replaceAll("/$", ""), organizationSlug,
          java.net.URLEncoder.encode(toEmail, StandardCharsets.UTF_8), setupCode);
        String body = """
                Hi %s,

                A staff account has been created for you on %s (employee number %s).

                Set your password before signing in:
                %s

                This link expires in 10 minutes and can only be used once.
                """.formatted(firstName, organizationDisplayName, employeeNumber, setupUrl);
        String escapedUrl = setupUrl.replace("&", "&amp;").replace("\"", "&quot;");
        String html = """
                <p>Hi %s,</p>
                <p>A staff account has been created for you on %s (employee number %s).</p>
                <p><a href="%s">Set your password before signing in</a></p>
                <p>This link expires in 10 minutes and can only be used once.</p>
                """.formatted(firstName, organizationDisplayName, employeeNumber, escapedUrl);
        send(toEmail, subject, body, html);
    }

    // Fired once per operator PlatformOperatorService.createOperator()
    // creates. Unlike the two emails above, there's no organization or
    // employeeNumber to include — a platform operator isn't scoped to a
    // tenant at all — and the sign-in link is /platform/login, not /login.
    // Also doesn't promise a forced password change on first sign-in, unlike
    // the other two: that's User.mustChangePassword, and PlatformOperator has
    // no equivalent field or enforcement today, nor any self-service
    // change-password endpoint yet — this account keeps the temporary
    // password as its real one until someone deliberately gives it a new
    // hash.
    public void sendPlatformOperatorAccountCreatedEmail(String toEmail, String firstName,
                                                          String temporaryPassword) {
        String subject = "Your platform operator account is ready";
        String body = """
                Hi %s,

                A platform operator account has been created for you.

                Sign in at %s/platform/login with:
                  Email: %s
                  Temporary password: %s

                Keep this password safe — there's no self-service way to change it yet, so \
                treat it as a standing credential rather than a temporary one for now.
                """.formatted(firstName, frontendBaseUrl, toEmail, temporaryPassword);
        send(toEmail, subject, body);
    }

    // Fired once per PasswordResetService.requestReset() call — the piece
    // that TODO used to flag as missing (this class only knew how to send
    // account-created emails before): the code was being generated and
    // hashed into password_reset_tokens with nowhere for the real value to
    // go, making the whole flow undeliverable even once the frontend called
    // the real endpoint instead of its mock. codeTtlMinutes is passed
    // through rather than hardcoded here — PasswordResetService.CODE_TTL is
    // the one source of truth for how long the code is actually valid.
    public void sendPasswordResetCodeEmail(String toEmail, String firstName, String code, long codeTtlMinutes) {
        String subject = "Your password reset code";
        String body = """
                Hi %s,

                Someone requested a password reset for this account. If that was you, use \
                this code to continue:

                  %s

                This code expires in %d minutes and can only be used once. If you didn't \
                request this, you can ignore this email — your password hasn't changed.
                """.formatted(firstName, code, codeTtlMinutes);
        send(toEmail, subject, body);
    }

    // Fired once per PlatformOperatorService.resetPassword() call — the
    // admin-triggered counterpart to sendPlatformOperatorAccountCreatedEmail
    // above, for an operator who already has an account but needs a new
    // password (platform operators have no self-service reset flow, unlike
    // tenant staff's /api/v1/auth/password-reset/**).
    public void sendPlatformOperatorPasswordResetEmail(String toEmail, String firstName,
                                                         String temporaryPassword) {
        String subject = "Your platform operator password has been reset";
        String body = """
                Hi %s,

                Your platform operator password has been reset by another operator.

                Sign in at %s/platform/login with:
                  Email: %s
                  Temporary password: %s

                If you didn't expect this, contact your platform team right away.
                """.formatted(firstName, frontendBaseUrl, toEmail, temporaryPassword);
        send(toEmail, subject, body);
    }

    // Fired once per StaffService.resetPassword() call — the admin-triggered
    // counterpart to sendStaffAccountCreatedEmail/sendAdminAccountCreatedEmail
    // above, for a staff member (or org admin) who already has an account
    // but needs a new password. Distinct from sendPasswordResetCodeEmail:
    // that one is the self-service, user-initiated flow (a 6-digit code the
    // recipient enters themselves); this one is an admin directly generating
    // and handing over a new working password, same shape as account
    // creation.
    public void sendStaffPasswordResetEmail(String toEmail, String firstName, String organizationDisplayName,
                                             String organizationSlug, String temporaryPassword) {
        String subject = "Your password has been reset — " + organizationDisplayName;
        String body = """
                Hi %s,

                Your account password on %s has been reset by an administrator.

                Sign in at %s/org/%s/login with:
                  Email: %s
                  Temporary password: %s

                You'll be asked to choose a new password the first time you sign in — this \
                temporary one stops working once you do.
                """.formatted(firstName, organizationDisplayName, frontendBaseUrl, organizationSlug, toEmail,
                temporaryPassword);
        send(toEmail, subject, body);
    }

    private void send(String toEmail, String subject, String body) {
      send(toEmail, subject, body, null);
    }

    private void send(String toEmail, String subject, String body, String htmlBody) {
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
        if (htmlBody == null) {
          deliveryWorker.deliver(toEmail, subject, body);
        } else {
          deliveryWorker.deliverHtml(toEmail, subject, body, htmlBody);
        }
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
