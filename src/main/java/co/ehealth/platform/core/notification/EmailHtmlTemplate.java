package co.ehealth.platform.core.notification;

import java.util.List;

// Shared HTML "chrome" for every outbound email — the table-based,
// inline-styled shell, info box, code box, button and footer that
// EmailService's own per-notification methods assemble around. Pulled out
// here so those seven methods stay about their own content (who, what
// happened, which values) rather than each repeating ~40 lines of
// email-safe table markup. Deliberately not a Spring bean — no
// dependencies, nothing to inject, just string building.
//
// Table-based layout with inline styles throughout, not the flex/grid CSS
// the design canvas mockups use — Outlook's desktop rendering engine (Word,
// not a real browser engine) and a long tail of other mail clients don't
// support CSS flexbox/grid or even <div> layout reliably; nested
// <table>/<td> with inline style="" is still the only layout approach that
// survives across real inboxes.
final class EmailHtmlTemplate {

    // Matches Frontend/src/index.css's own token values exactly, copied
    // rather than shared — this is a separate deployable (the backend
    // has no build-time access to the frontend's CSS) with no runtime
    // path to read them, the same reasoning DevSeedDataRunner's seed data
    // is its own copy rather than a shared fixture.
    private static final String SURFACE = "#f4f5f3";
    private static final String SURFACE_RAISED = "#ffffff";
    private static final String SURFACE_SUNKEN = "#eceeec";
    private static final String BORDER = "#dfe2dd";
    private static final String INK_900 = "#171916";
    private static final String TEXT_SECONDARY = "#636a62";
    private static final String BRAND_300 = "#82b8af";
    private static final String BRAND_50 = "#eef6f5";
    private static final String BRAND_500 = "#1f6f63";
    private static final String BRAND_600 = "#185950";
    private static final String BRAND_700 = "#144840";
    private static final String SUCCESS_500 = "#227a4d";
    private static final String SUCCESS_600 = "#1c6540";
    private static final String AMBER_600 = "#8a5117";
    private static final String FONT_SANS = "'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif";
    private static final String FONT_MONO = "ui-monospace,'Cascadia Code','SF Mono',Menlo,Consolas,monospace";

    private EmailHtmlTemplate() {
    }

    // BRAND for every staff/admin/platform-operator email; SUCCESS only
    // for the patient-migrated notice — a deliberately warmer, softer
    // accent for the one template in this system that's patient-facing
    // rather than staff-facing (see sendPatientMigratedEmail()'s own
    // why-note on tone).
    enum Accent {
        BRAND, SUCCESS
    }

    enum FooterAudience {
        STAFF, PLATFORM, PATIENT
    }

    record InfoRow(String label, String value) {
    }

    // The full HTML document every email is — accent bar, logo header,
    // whatever bodyHtml/footerHtml the caller already assembled from the
    // pieces below. logo is a CID inline attachment (EmailDeliveryWorker's
    // own why-note on why, not a hosted <img src>), referenced by the
    // constant it addInline()s under.
    static String shell(Accent accent, String bodyHtml, String footerHtml) {
        String accentColor = accent == Accent.SUCCESS ? SUCCESS_500 : BRAND_500;
        return """
                <!doctype html>
                <html lang="en">
                <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1">
                <meta name="color-scheme" content="light">
                <style>
                @media only screen and (max-width:600px) {
                  .email-outer { padding:16px 8px !important; }
                  .email-section { padding-left:20px !important; padding-right:20px !important; }
                  .email-button { width:100%% !important; }
                  .email-button a { display:block !important; text-align:center !important; }
                }
                </style>
                </head>
                <body style="margin:0;padding:0;background:%1$s;font-family:%2$s;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:%1$s;">
                <tr><td class="email-outer" align="center" style="padding:40px 16px;">
                <!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%%;table-layout:fixed;background:%3$s;border:1px solid %4$s;border-radius:10px;">
                <tr><td style="height:5px;line-height:5px;font-size:0;background:%5$s;border-radius:10px 10px 0 0;">&nbsp;</td></tr>
                <tr><td class="email-section" style="padding:24px 40px;border-bottom:1px solid %4$s;">
                <img src="cid:%6$s" width="95" height="64" alt="Ulwembu" style="display:block;border:0;outline:none;">
                <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#636a62;">Healthcare Management System</p>
                </td></tr>
                <tr><td class="email-section" style="padding:32px 40px 16px;overflow-wrap:anywhere;word-wrap:break-word;">
                %7$s
                </td></tr>
                <tr><td class="email-section" style="padding:24px 40px;background:%1$s;border-top:1px solid %4$s;">
                %8$s
                </td></tr>
                </table>
                <!--[if mso]></td></tr></table><![endif]-->
                </td></tr>
                </table>
                </body>
                </html>
                """.formatted(SURFACE, FONT_SANS, SURFACE_RAISED, BORDER, accentColor,
                EmailDeliveryWorker.LOGO_CONTENT_ID, bodyHtml, footerHtml);
    }

    static String kicker(Accent accent, String label) {
        String color = accent == Accent.SUCCESS ? SUCCESS_600 : BRAND_600;
        return """
                <h1 style="margin:0 0 24px;font-size:26px;line-height:1.25;font-weight:700;color:%s;">%s</h1>
                """.formatted(color, label);
    }

    static String greeting(String html) {
        return """
                <p style="margin:0 0 12px;font-size:16px;font-weight:600;line-height:1.5;color:%s;">%s</p>
                """.formatted(INK_900, html);
    }

    static String lead(String html) {
        return """
                <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:%s;">%s</p>
                """.formatted(INK_900, html);
    }

    static String muted(String html) {
        return """
                <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:%s;">%s</p>
                """.formatted(TEXT_SECONDARY, html);
    }

    // A titled key/value block — sign-in credentials or a record number.
    // Padding lives on the <td>, never the <table> itself: table-level CSS
    // padding is exactly the kind of rule Outlook's rendering engine drops
    // silently (see this class's own why-note).
    static String infoBox(String title, List<InfoRow> rows) {
        StringBuilder rowsHtml = new StringBuilder();
        for (int i = 0; i < rows.size(); i++) {
            InfoRow row = rows.get(i);
            String borderTop = i == 0 ? "none" : "1px solid " + BORDER;
            String paddingTop = i == 0 ? "0" : "7px";
            rowsHtml.append("""
                    <tr>
                    <td style="padding:12px 0;padding-top:%s;border-top:%s;">
                    <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:%s;">%s</p>
                    <p style="margin:0;font-size:15px;line-height:1.6;font-family:%s;font-weight:600;color:%s;overflow-wrap:anywhere;word-break:break-all;">%s</p>
                    </td>
                    </tr>
                    """.formatted(paddingTop, borderTop, TEXT_SECONDARY, row.label(),
                    FONT_MONO, INK_900, row.value()));
        }
        return """
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;">
                <tr><td style="background:%s;border:1px solid %s;border-radius:8px;padding:18px 22px;">
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
                <tr><td style="padding-bottom:16px;font-size:13px;font-weight:700;color:%s;">%s</td></tr>
                %s
                </table>
                </td></tr>
                </table>
                """.formatted(SURFACE_SUNKEN, BORDER, TEXT_SECONDARY, title, rowsHtml);
    }

    // The password-reset-code template's own centerpiece — a large,
    // letter-spaced code plus an expiry countdown, dashed border echoing
    // the design canvas mockup's own code box.
    static String codeBox(String code, String expiryText) {
        return """
                <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
                <tr><td align="center" style="background:%s;border:1.5px dashed %s;border-radius:10px;padding:24px;">
                <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:%s;text-transform:uppercase;letter-spacing:0.06em;">Your reset code</p>
                <p style="margin:0;font-family:%s;font-size:32px;line-height:1.5;font-weight:700;color:%s;letter-spacing:0.16em;white-space:nowrap;">%s</p>
                <p style="margin:12px 0 0;font-size:12.5px;font-weight:600;color:%s;">%s</p>
                </td></tr>
                </table>
                """.formatted(BRAND_50, BRAND_300, BRAND_600, FONT_MONO, BRAND_700, code, AMBER_600, expiryText);
    }

    static String ctaButton(Accent accent, String href, String label) {
        String bg = accent == Accent.SUCCESS ? SUCCESS_500 : BRAND_500;
        return """
                <table class="email-button" role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 28px;">
                <tr><td style="border-radius:8px;background:%s;">
                <a href="%s" target="_blank" style="display:inline-block;border:14px solid %s;padding:0 10px;font-size:16px;line-height:1.5;font-weight:700;font-family:%s;color:#ffffff;text-decoration:none;border-radius:8px;mso-padding-alt:0;text-underline-color:%s;">%s</a>
                </td></tr>
                </table>
                """.formatted(bg, esc(href), bg, FONT_SANS, bg, esc(label));
    }

    // Same three-line disclaimer every plain-text body already ends
    // with (EmailService's own footer sentence per method) — audience
    // only changes which product name and "if unexpected" contact this
    // reads.
    static String footer(FooterAudience audience) {
        String product = audience == FooterAudience.PLATFORM
                ? "the Ulwembu Platform Console" : "the Ulwembu Healthcare Management System";
        String ifUnexpected = switch (audience) {
            case STAFF -> "If you weren't expecting this, contact your clinic administrator.";
            case PLATFORM -> "If you weren't expecting this, contact your platform team right away.";
            case PATIENT -> "If you weren't expecting this, please contact your previous clinic.";
        };
        return """
                <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:%1$s;">This is an automated message from %2$s &mdash; please don&rsquo;t reply to this email.</p>
                <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:%1$s;">%3$s</p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:%4$s;">&copy; 2026 Ulwembu Healthcare Management System</p>
                """.formatted(TEXT_SECONDARY, product, ifUnexpected, TEXT_SECONDARY);
    }

    // Every dynamic value (org names, facility names, employee numbers —
    // all admin-entered at some point, not just system-generated) goes
    // through this before landing in an HTML attribute or text node.
    // Emails don't execute script the way a browser page would, but an
    // unescaped "&"/"<" from a real display name still breaks the layout
    // visually, and there's no reason to skip the same discipline a real
    // web page would need.
    static String esc(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
