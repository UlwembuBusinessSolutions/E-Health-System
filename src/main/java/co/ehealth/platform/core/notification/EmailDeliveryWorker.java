package co.ehealth.platform.core.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

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

    private final JavaMailSender mailSender;
    private final String fromAddress;

    EmailDeliveryWorker(JavaMailSender mailSender,
                         @Value("${app.notifications.from-address}") String fromAddress) {
        this.mailSender = mailSender;
        this.fromAddress = fromAddress;
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
    void deliver(String toEmail, String subject, String body) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromAddress);
                message.setTo(toEmail);
                message.setSubject(subject);
                message.setText(body);
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
