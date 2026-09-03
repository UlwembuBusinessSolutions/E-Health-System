// package co.ehealth.platform.core.common;

// import jakarta.servlet.http.HttpServletRequest;
// import org.springframework.web.context.request.RequestContextHolder;
// import org.springframework.web.context.request.ServletRequestAttributes;

// // Single place every audit write (AuditLogService.append(),
// // OrganizationProvisioningService.recordPlatformAudit()) reads "who called
// // this, from where" from — replaces the old pattern of threading
// // HttpServletRequest.getRemoteAddr() through every controller-to-service
// // call chain by hand, which is exactly how 8 of the 15 pre-existing
// // auditLogService.append() call sites ended up passing a literal null:
// // nothing forced a new call site to remember to thread it. Reading
// // RequestContextHolder here instead means every write captures this
// // automatically, including future ones.
// public final class RequestMetadata {

//     private RequestMetadata() {
//     }

//     // Genuinely null outside a real HTTP request (a background job, a
//     // dev-only ApplicationRunner seeding data at startup) — every caller
//     // already treats a null ipAddress/deviceSignature as legitimate, same
//     // as the old threaded parameter did.
//     private static HttpServletRequest currentRequest() {
//         var attributes = RequestContextHolder.getRequestAttributes();
//         return attributes instanceof ServletRequestAttributes servletAttributes ? servletAttributes.getRequest() : null;
//     }

//     // X-Forwarded-For first, if present — this app sits behind a reverse
//     // proxy in any real deployment (docker-compose's own api service is the
//     // simplest case), and getRemoteAddr() alone would just log the proxy's
//     // address for every request. Takes the first (client) hop only; a
//     // multi-hop chain's intermediate proxies aren't this app's concern.
//     public static String currentIpAddress() {
//         HttpServletRequest request = currentRequest();
//         if (request == null) {
//             return null;
//         }
//         String forwardedFor = request.getHeader("X-Forwarded-For");
//         if (forwardedFor != null && !forwardedFor.isBlank()) {
//             return forwardedFor.split(",")[0].trim();
//         }
//         return request.getRemoteAddr();
//     }

//     // The raw User-Agent header — "device signature" in the FRS's own
//     // vocabulary (Section 3.3's Audit Integration Contract). Not parsed
//     // into browser/OS/device components: that's a presentation concern for
//     // whoever reads the audit trail, not something to bake into what gets
//     // stored, and User-Agent strings are notoriously inconsistent to parse
//     // reliably server-side without a dedicated library this codebase
//     // doesn't otherwise need.
//     public static String currentUserAgent() {
//         HttpServletRequest request = currentRequest();
//         return request == null ? null : request.getHeader("User-Agent");
//     }
// }

package co.ehealth.platform.core.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class RequestMetadata {

    private RequestMetadata() {
    }

    private static HttpServletRequest currentRequest() {
        var attributes = RequestContextHolder.getRequestAttributes();
        return attributes instanceof ServletRequestAttributes servletAttributes ? servletAttributes.getRequest() : null;
    }

    public static String currentIpAddress() {
        HttpServletRequest request = currentRequest();
        return request == null ? null : currentIpAddress(request);
    }

    public static String currentIpAddress(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    public static String currentUserAgent() {
        HttpServletRequest request = currentRequest();
        return request == null ? null : currentUserAgent(request);
    }

    public static String currentUserAgent(HttpServletRequest request) {
        return request.getHeader("User-Agent");
    }
}