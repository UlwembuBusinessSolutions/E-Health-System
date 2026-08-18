package co.ehealth.platform.platform;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Exception thrown when attempting to disable a foundation module.
 *
 * Foundation modules (SADM, AUDT, IAM) are permanently enabled
 * and cannot be disabled. Every write path in the system depends
 * on these modules being reachable.
 *
 * This exception maps to HTTP 409 Conflict, following the same
 * pattern as LastRemainingAdminException.
 */
@ResponseStatus(HttpStatus.CONFLICT)
public class FoundationModuleException extends RuntimeException {


        
    public FoundationModuleException(String message) {
        super(message);
    }
}

