package co.ehealth.platform.core.common;

import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

public final class FilterResponses {

    private FilterResponses() {
    }

    // Escaping here is deliberately minimal — every call site passes a
    // fixed, developer-authored string, never anything from the request,
    // so a full JSON writer isn't needed just for this.
    public static void writeJsonError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"message\":\"" + message.replace("\"", "'") + "\"}");
    }
}
