package co.ehealth.platform.core.notification;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.Properties;

// Split out from EmailService specifically so @Async takes effect. Spring's
// method-level annotations (@Async, @Transactional, ...) are implemented as
// proxies wrapped around a bean — a call from one method to another on the
// SAME bean (this.send(...), as EmailService used to do) never passes
// through that proxy, so it would run synchronously no matter what the
// annotation says, silently defeating the whole point. Calling across a
// bean boundary — EmailService into this class — is what makes the proxy,
// and therefore the async dispatch, actually apply. Package-private:
// nothing outside core.notification calls this directly, only EmailService.
@Component
class EmailDeliveryWorker {

    private static final Logger log = LoggerFactory.getLogger(EmailDeliveryWorker.class);
    private static final int MAX_ATTEMPTS = 3;
    private static final long[] RETRY_DELAY_MS = {1000, 3000};

    // Referenced from HTML bodies as "cid:" + LOGO_CONTENT_ID
    // (EmailService's own htmlShell() builds that img src) — package-
    // visible so the two stay in sync from one constant instead of two
    // copies of the same string that could drift. The image itself is
    // bundled here, not linked from Frontend/public/ulwembu-logo.png:
    // this is a separate deployable, and an inline (CID) attachment
    // renders correctly for every recipient regardless of whether the
    // frontend's own origin is publicly reachable or blocks
    // remote-image loading, unlike a hosted <img src="https://...">.
    static final String LOGO_CONTENT_ID = "ulwembuLogo";
    private static final ClassPathResource LOGO_RESOURCE = new ClassPathResource("email/ulwembu-logo.png");

    private final JavaMailSender defaultMailSender;

    EmailDeliveryWorker(JavaMailSender defaultMailSender) {
        this.defaultMailSender = defaultMailSender;
    }

    // Runs on emailTaskExecutor (EmailAsyncConfig), never the request
    // thread — EmailService.sendAdminAccountCreatedEmail() has already
    // returned to its caller by the time this executes. Up to 3 attempts
    // with a short backoff between them; still swallows the final failure
    // rather than throwing, same reasoning as the code this replaced — the
    // account this email is about already exists and works regardless.
    // Nothing about the message content is ever at risk of being lost even
    // when every attempt here fails: EmailService's captureToFile() already
    // wrote it to disk synchronously, before this method was even
    // dispatched.
    @Async("emailTaskExecutor")
    void deliver(String toEmail, String subject, String textBody, String htmlBody, String fromAddress,
                 MailOverride override) {
        JavaMailSender mailSender = override != null ? buildOverrideSender(override) : defaultMailSender;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                MimeMessage message = mailSender.createMimeMessage();
                // MULTIPART_MODE_RELATED, not the boolean-true overload —
                // this is what lets setText(text, html) (a multipart/
                // alternative part) and addInline() (the logo) coexist in
                // one message; the boolean overload only gives
                // multipart/mixed, which many clients render as a
                // dangling attachment instead of an inline image.
                MimeMessageHelper helper = new MimeMessageHelper(message, MimeMessageHelper.MULTIPART_MODE_RELATED,
                        "UTF-8");
                helper.setFrom(fromAddress);
                helper.setTo(toEmail);
                helper.setSubject(subject);
                helper.setText(textBody, htmlBody);
                helper.addInline(LOGO_CONTENT_ID, LOGO_RESOURCE);
                mailSender.send(message);
                // Logged unconditionally, including a first-try success —
                // previously silent, which made a genuine send indistinguishable
                // from the async task never having run at all. Found the hard
                // way: a real send against this environment's SMTP credentials
                // succeeded with zero log output, and only manually checking the
                // inbox confirmed it — logs alone couldn't tell the difference.
                log.info("Email sent to {} on attempt {}/{}", toEmail, attempt, MAX_ATTEMPTS);
                return;
            } catch (Exception ex) {
                if (attempt == MAX_ATTEMPTS) {
                    // Expected outcome in this environment: no real SMTP
                    // credentials are configured, so every attempt fails
                    // the same way and this is exactly what should happen.
                    log.warn("Failed to send email to {} after {} attempts "
                                    + "(expected without real SMTP credentials configured)",
                            toEmail, MAX_ATTEMPTS, ex);
                    return;
                }
                sleepBeforeRetry(RETRY_DELAY_MS[attempt - 1], toEmail, attempt, ex);
            }
        }
    }

    // Built fresh per send rather than cached — a tenant can change its
    // mail settings between two emails, and this is cheap enough (no
    // network I/O, just a POJO) that reusing a stale sender isn't worth the
    // bookkeeping. mail.smtp.auth/starttls.enable mirror application.yml's
    // spring.mail.properties for the default sender, since Spring Boot's
    // auto-configuration doesn't apply to a manually constructed
    // JavaMailSenderImpl.
    private static JavaMailSender buildOverrideSender(MailOverride override) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(override.host());
        sender.setPort(override.port());
        sender.setUsername(override.username());
        sender.setPassword(override.password());
        Properties props = sender.getJavaMailProperties();
        props.put("mail.smtp.auth", "true");
        props.put("mail.smtp.starttls.enable", "true");
        props.put("mail.smtp.connectiontimeout", "5000");
        props.put("mail.smtp.timeout", "5000");
        props.put("mail.smtp.writetimeout", "5000");
        return sender;
    }

    private void sleepBeforeRetry(long delayMs, String toEmail, int attempt, Exception ex) {
        log.info("Email send to {} failed on attempt {}/{}, retrying in {}ms: {}",
                toEmail, attempt, MAX_ATTEMPTS, delayMs, ex.getMessage());
        try {
            Thread.sleep(delayMs);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
