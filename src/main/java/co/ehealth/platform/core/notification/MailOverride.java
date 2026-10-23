package co.ehealth.platform.core.notification;

// EmailDeliveryWorker's own view of a tenant's SMTP credentials — resolved
// by EmailService (via OrganizationMailSettingsService) on the request
// thread, since TenantContext is a ThreadLocal and wouldn't be visible from
// deliver()'s @Async thread. null means "no tenant override, use the
// platform-wide spring.mail.* JavaMailSender bean" — the same outcome as
// before this feature existed.
record MailOverride(String host, int port, String username, String password) {
}
