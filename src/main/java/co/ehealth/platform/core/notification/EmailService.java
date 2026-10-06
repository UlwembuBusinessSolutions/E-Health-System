package co.ehealth.platform.core.notification;

import co.ehealth.platform.core.tenant.OrganizationMailSettingsService;
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
import java.util.List;
import java.util.Optional;

import static co.ehealth.platform.core.notification.EmailHtmlTemplate.Accent;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.FooterAudience;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.InfoRow;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.codeBox;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.ctaButton;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.esc;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.footer;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.greeting;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.infoBox;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.kicker;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.lead;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.muted;
import static co.ehealth.platform.core.notification.EmailHtmlTemplate.shell;

// One method per notification this system actually sends, not a generic
// send(to, subject, body) every caller composes by hand — keeps "what does
// this email say" in one place, same reasoning as AuditLogService being the
// one write path for audit rows rather than each caller building one itself.
//
// Each method builds both a plain-text body (the long-standing format —
// still the disk-captured record and the multipart/alternative fallback
// for clients that don't render HTML) and an HTML body via
// EmailHtmlTemplate's shared shell/components, branded to match the app's
// own design tokens (Frontend/src/index.css) and the real Ulwembu
// wordmark. Content is identical between the two — the HTML version never
// says anything the plain-text one doesn't.
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final DateTimeFormatter FILE_TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmssSSS");

    private final EmailDeliveryWorker deliveryWorker;
    private final OrganizationMailSettingsService mailSettingsService;
    private final String fromAddress;
    private final String frontendBaseUrl;
    private final Path captureDir;
    private final Clock clock;

    public EmailService(EmailDeliveryWorker deliveryWorker,
                         OrganizationMailSettingsService mailSettingsService,
                         @Value("${app.notifications.from-address}") String fromAddress,
                         @Value("${app.frontend.base-url}") String frontendBaseUrl,
                         @Value("${app.notifications.capture-dir}") String captureDir,
                         Clock clock) {
        this.deliveryWorker = deliveryWorker;
        this.mailSettingsService = mailSettingsService;
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
        String html = shell(Accent.BRAND,
                kicker(Accent.BRAND, "Your admin account is ready")
                        + greeting("Hi " + esc(firstName) + ",")
                        + lead("An administrator account has been created for you on <strong>"
                        + esc(organizationDisplayName) + "</strong>.")
                        + infoBox("Sign-in details", List.of(
                        new InfoRow("Organization", esc(organizationSlug)),
                        new InfoRow("Email", esc(toEmail)),
                        new InfoRow("Temporary password", esc(temporaryPassword))))
                        + ctaButton(Accent.BRAND, frontendBaseUrl + "/login", "Sign in to Ulwembu")
                        + muted("You&rsquo;ll be asked to choose a new password the first time you sign in "
                        + "&mdash; this temporary one stops working once you do."),
                footer(FooterAudience.STAFF));
        send(toEmail, subject, body, html);
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
        String html = shell(Accent.BRAND,
                kicker(Accent.BRAND, "Your staff account is ready")
                        + greeting("Hi " + esc(firstName) + ",")
                        + lead("A staff account has been created for you on <strong>" + esc(organizationDisplayName)
                        + "</strong> (employee number <strong>" + esc(employeeNumber) + "</strong>).")
                        + infoBox("Sign-in details", List.of(
                        new InfoRow("Organization", esc(organizationSlug)),
                        new InfoRow("Email", esc(toEmail)),
                        new InfoRow("Temporary password", esc(temporaryPassword))))
                        + ctaButton(Accent.BRAND, frontendBaseUrl + "/login", "Sign in to Ulwembu")
                        + muted("You&rsquo;ll be asked to choose a new password the first time you sign in "
                        + "&mdash; this temporary one stops working once you do."),
                footer(FooterAudience.STAFF));
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
        String html = shell(Accent.BRAND,
                kicker(Accent.BRAND, "Your platform account is ready")
                        + greeting("Hi " + esc(firstName) + ",")
                        + lead("A platform operator account has been created for you.")
                        + infoBox("Sign-in details", List.of(
                        new InfoRow("Email", esc(toEmail)),
                        new InfoRow("Temporary password", esc(temporaryPassword))))
                        + ctaButton(Accent.BRAND, frontendBaseUrl + "/platform/login", "Sign in to the Platform Console")
                        + muted("Keep this password safe &mdash; there&rsquo;s no self-service way to change it yet, "
                        + "so treat it as a standing credential rather than a temporary one for now."),
                footer(FooterAudience.PLATFORM));
        send(toEmail, subject, body, html);
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
        String html = shell(Accent.BRAND,
                kicker(Accent.BRAND, "Reset your password")
                        + greeting("Hi " + esc(firstName) + ",")
                        + lead("Someone requested a password reset for this account. If that was you, use this "
                        + "code to continue:")
                        + codeBox(esc(code), "Expires in " + codeTtlMinutes + " minutes")
                        + muted("This code can only be used once. If you didn&rsquo;t request this, you can ignore "
                        + "this email &mdash; your password hasn&rsquo;t changed."),
                footer(FooterAudience.STAFF));
        send(toEmail, subject, body, html);
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
        String html = shell(Accent.BRAND,
                kicker(Accent.BRAND, "Your platform password was reset")
                        + greeting("Hi " + esc(firstName) + ",")
                        + lead("Your platform operator password has been reset by another operator.")
                        + infoBox("Sign-in details", List.of(
                        new InfoRow("Email", esc(toEmail)),
                        new InfoRow("Temporary password", esc(temporaryPassword))))
                        + ctaButton(Accent.BRAND, frontendBaseUrl + "/platform/login", "Sign in to the Platform Console")
                        + muted("If you didn&rsquo;t expect this, contact your platform team right away."),
                footer(FooterAudience.PLATFORM));
        send(toEmail, subject, body, html);
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
        String html = shell(Accent.BRAND,
                kicker(Accent.BRAND, "Your password was reset")
                        + greeting("Hi " + esc(firstName) + ",")
                        + lead("Your account password on <strong>" + esc(organizationDisplayName)
                        + "</strong> has been reset by an administrator.")
                        + infoBox("Sign-in details", List.of(
                        new InfoRow("Email", esc(toEmail)),
                        new InfoRow("Temporary password", esc(temporaryPassword))))
                        + ctaButton(Accent.BRAND, frontendBaseUrl + "/org/" + organizationSlug + "/login",
                        "Sign in to Ulwembu")
                        + muted("You&rsquo;ll be asked to choose a new password the first time you sign in "
                        + "&mdash; this temporary one stops working once you do."),
                footer(FooterAudience.STAFF));
        send(toEmail, subject, body, html);
    }

    // Fired once per PatientMigrationService.migrate() call that succeeds
    // AND has an email on file (decision #4 — silently skipped otherwise,
    // same as every other "no address, no email" case in this system).
    // Reassures the recipient that their prior visit/vitals/prescription
    // history hasn't been lost — it hasn't, it just stays at the previous
    // clinic (decision #2's own "fresh clinical history" line) — since a
    // bare "your record moved" notice alone could easily read as "your
    // history is gone." The one template with FooterAudience.PATIENT and
    // Accent.SUCCESS — warmer tone, no credentials to show, so no CTA
    // button either.
    public void sendPatientMigratedEmail(String toEmail, String firstName, String destinationOrganizationDisplayName,
                                          String destinationFacilityName, String newMpiNumber) {
        String subject = "Your medical record has moved to " + destinationOrganizationDisplayName;
        String body = """
                Hi %s,

                Your medical record has been transferred to %s at %s.

                Your new record number there is %s.

                Your visit history, vitals, and prescriptions from your previous clinic remain on file \
                there and are not affected by this transfer.

                If you weren't expecting this, please contact your previous clinic.
                """.formatted(firstName, destinationFacilityName, destinationOrganizationDisplayName, newMpiNumber);
        String html = shell(Accent.SUCCESS,
                kicker(Accent.SUCCESS, "Your clinic transfer is complete")
                        + greeting("Hi " + esc(firstName) + ",")
                        + lead("Your medical record has been transferred to <strong>"
                        + esc(destinationFacilityName) + "</strong> at <strong>"
                        + esc(destinationOrganizationDisplayName) + "</strong>.")
                        + infoBox("Your new record", List.of(new InfoRow("Record number", esc(newMpiNumber))))
                        + lead("Your visit history, vitals, and prescriptions from your previous clinic remain "
                        + "on file there and are not affected by this transfer.")
                        + muted("If you weren&rsquo;t expecting this, please contact your previous clinic."),
                footer(FooterAudience.PATIENT));
        send(toEmail, subject, body, html);
    }

    // Fired once per PrescriptionService.sendPrescriberMessage() call — a
    // pharmacy query about a specific prescription that isn't a stock or
    // dispensing action (a dosage concern, missing information, anything
    // needing the prescriber's own clinical judgment). No CTA button: there
    // is no prescriber-facing web view of this thread today, only the
    // pharmacy's own history and this email — the prescriber's reply
    // channel is whatever they already use (phone, in person), not a link
    // back into the app.
    public void sendPrescriberQueryEmail(String toEmail, String prescriberFirstName, String organizationDisplayName,
                                          String senderName, String prescriptionSerialNumber, String message) {
        String subject = "Question about prescription " + prescriptionSerialNumber + " — " + organizationDisplayName;
        String body = """
                Hi %s,

                %s at %s has a question about prescription %s:

                "%s"

                Please follow up with the pharmacy directly.
                """.formatted(prescriberFirstName, senderName, organizationDisplayName, prescriptionSerialNumber,
                message);
        String html = shell(Accent.BRAND,
                kicker(Accent.BRAND, "A question about a prescription")
                        + greeting("Hi " + esc(prescriberFirstName) + ",")
                        + lead(esc(senderName) + " at <strong>" + esc(organizationDisplayName)
                        + "</strong> has a question about prescription <strong>"
                        + esc(prescriptionSerialNumber) + "</strong>:")
                        + infoBox("Message", List.of(new InfoRow("From " + esc(senderName), esc(message))))
                        + muted("Please follow up with the pharmacy directly."),
                footer(FooterAudience.STAFF));
        send(toEmail, subject, body, html);
    }

    // AppointmentService calls these only after the booking transaction commits.
    public void sendAppointmentConfirmedEmail(String toEmail, String firstName, String organizationDisplayName,
                                               String facilityName, String appointmentDate, String appointmentTime,
                                               String assignedStaffName) {
        sendAppointmentEmail(toEmail, firstName, organizationDisplayName, facilityName, appointmentDate,
                appointmentTime, assignedStaffName, false);
    }

    public void sendAppointmentUpdatedEmail(String toEmail, String firstName, String organizationDisplayName,
                                             String facilityName, String appointmentDate, String appointmentTime,
                                             String assignedStaffName) {
        sendAppointmentEmail(toEmail, firstName, organizationDisplayName, facilityName, appointmentDate,
                appointmentTime, assignedStaffName, true);
    }

    private void sendAppointmentEmail(String toEmail, String firstName, String organizationDisplayName,
                                      String facilityName, String appointmentDate, String appointmentTime,
                                      String assignedStaffName, boolean updated) {
        String heading = updated ? "Your appointment has been updated" : "Your appointment is confirmed";
        String action = updated ? "updated" : "confirmed";
        String subject = heading + " — " + organizationDisplayName;
        String staffLine = assignedStaffName == null ? "" : "\n  With: " + assignedStaffName;
        String body = """
                Hi %s,

                Your appointment at %s has been %s.

                  Facility: %s
                  Date: %s
                  Time: %s%s

                If you need to reschedule or cancel, please contact the clinic directly.
                """.formatted(firstName, organizationDisplayName, action, facilityName, appointmentDate, appointmentTime,
                staffLine);
        List<InfoRow> rows = new java.util.ArrayList<>(List.of(
                new InfoRow("Facility", esc(facilityName)),
                new InfoRow("Date", esc(appointmentDate)),
                new InfoRow("Time", esc(appointmentTime))));
        if (assignedStaffName != null) rows.add(new InfoRow("With", esc(assignedStaffName)));
        String html = shell(Accent.SUCCESS,
                kicker(Accent.SUCCESS, heading)
                        + greeting("Hi " + esc(firstName) + ",")
                        + lead("Your appointment at <strong>" + esc(organizationDisplayName) + "</strong> has been " + action + ".")
                        + infoBox("Appointment details", rows)
                        + muted("If you need to reschedule or cancel, please contact the clinic directly."),
                footer(FooterAudience.PATIENT));
        send(toEmail, subject, body, html);
    }

    private void send(String toEmail, String subject, String textBody, String htmlBody) {
        // Resolved here, on the request thread, not inside
        // EmailDeliveryWorker — TenantContext is a ThreadLocal, so it's only
        // readable before the @Async hop, and only some callers even have a
        // tenant to resolve (PlatformOperatorService's emails run outside
        // TenantContext entirely, same as before this feature existed).
        // Empty means "no tenant override" and falls back to the app-wide
        // fromAddress/JavaMailSender exactly as it always has.
        Optional<OrganizationMailSettingsService.MailCredentials> override = mailSettingsService.resolveForCurrentTenant();
        String effectiveFrom = override.map(OrganizationMailSettingsService.MailCredentials::fromAddress)
                .filter(from -> from != null && !from.isBlank())
                .orElse(fromAddress);

        // Written synchronously, before this method returns — this is the
        // verifiable "what would this email have said" record (see the
        // why-note below), and it should exist immediately, not only after
        // a background delivery attempt eventually finishes or fails. Text
        // only, not the HTML — the plain-text body already carries every
        // fact the HTML one does, and this file is a dev-inspection aid,
        // not the actual delivered artifact.
        captureToFile(toEmail, subject, textBody, effectiveFrom);
        // Everything past this point runs on a background thread
        // (EmailDeliveryWorker, EmailAsyncConfig's emailTaskExecutor) — this
        // call returns immediately regardless of how long the SMTP
        // attempt(s) take. Previously this sent inline: a slow (not even
        // down, just slow) mail server could add real latency to whatever
        // request triggered the email, and under enough concurrent load,
        // enough requests blocked on mail I/O at once could start starving
        // the app's own request-handling thread pool — the same failure
        // mode this split exists to remove.
        MailOverride mailOverride = override.map(creds ->
                new MailOverride(creds.host(), creds.port(), creds.username(), creds.password())).orElse(null);
        deliveryWorker.deliver(toEmail, subject, textBody, htmlBody, effectiveFrom, mailOverride);
    }

    // Local-dev/testing aid: every outbound email is written to disk BEFORE
    // the real send is attempted, and regardless of whether that send
    // succeeds — there's no real SMTP server configured yet in this
    // environment, so this is the only way to actually verify what an
    // email would have said. Not gated behind a profile check on purpose:
    // a real deployment would either point app.notifications.capture-dir
    // somewhere it doesn't matter, or this method would be revisited
    // before going to production with real patient-adjacent traffic.
    private void captureToFile(String toEmail, String subject, String body, String effectiveFrom) {
        try {
            Files.createDirectories(captureDir);
            String filename = "%s__%s.txt".formatted(
                    FILE_TIMESTAMP.format(clock.instant().atZone(java.time.ZoneOffset.UTC)),
                    toEmail.replaceAll("[^a-zA-Z0-9.@-]", "_"));
            String content = "To: %s\nFrom: %s\nSubject: %s\n\n%s".formatted(toEmail, effectiveFrom, subject, body);
            Files.writeString(captureDir.resolve(filename), content, StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.warn("Failed to capture outbound email to disk for {}", toEmail, e);
        }
    }
}
