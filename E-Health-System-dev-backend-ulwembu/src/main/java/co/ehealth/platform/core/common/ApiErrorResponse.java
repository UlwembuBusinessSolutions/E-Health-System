package co.ehealth.platform.core.common;

import java.util.Map;

public record ApiErrorResponse(String message, Map<String, String> fieldErrors) {
}
