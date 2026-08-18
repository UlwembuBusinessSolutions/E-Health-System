package co.ehealth.platform.core.common;

import co.ehealth.platform.core.security.InvalidTokenException;
import co.ehealth.platform.identity.AccountLockedException;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.InvalidCredentialsException;
import co.ehealth.platform.identity.InvalidResetCodeException;
import co.ehealth.platform.identity.LastRemainingAdminException;
import co.ehealth.platform.identity.NotAnOrgAdminException;
import co.ehealth.platform.identity.RateLimitExceededException;
import co.ehealth.platform.platform.FoundationModuleException;
import co.ehealth.platform.platform.OrganizationNotFoundException;
import co.ehealth.platform.platform.OrganizationSuspendedException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.lang.Nullable;

import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.io.UncheckedIOException;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Global exception handler for the platform.
 *
 * <p>
 * Centralizes application and Spring MVC exception handling so that all API
 * errors follow the same response structure:
 *
 * <pre>
 * {
 *     "message": "...",
 *     "fieldErrors": {
 *         "fieldName": "validation message"
 *     }
 * }
 * </pre>
 *
 * <p>
 * Extending {@link ResponseEntityExceptionHandler} allows Spring MVC framework
 * exceptions to be handled consistently as well.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log =
            LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // ============================================================
    // Authentication / Authorization
    // ============================================================

    /**
     * Handles invalid username/password authentication attempts.
     *
     * <p>
     * The same message is returned regardless of whether the email exists
     * or the password is incorrect.
     */
    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidCredentials(
            InvalidCredentialsException ex) {

        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse(
                        "Incorrect email or password.",
                        null
                ));
    }

    /**
     * Handles locked accounts.
     */
    @ExceptionHandler(AccountLockedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountLocked(
            AccountLockedException ex) {

        return ResponseEntity
                .status(423)
                .header(
                        "Retry-After",
                        String.valueOf(ex.getRetryAfterSeconds())
                )
                .body(new ApiErrorResponse(
                        "Too many failed attempts. Try again in a few minutes.",
                        null
                ));
    }

    /**
     * Handles invalid or expired authentication tokens.
     */
    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidToken(
            InvalidTokenException ex) {

        return ResponseEntity
                .status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse(
                        "Session expired. Please sign in again.",
                        null
                ));
    }

    /**
     * Handles invalid password reset codes.
     */
    @ExceptionHandler(InvalidResetCodeException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidResetCode(
            InvalidResetCodeException ex) {

        return ResponseEntity
                .badRequest()
                .body(new ApiErrorResponse(
                        "Incorrect or expired code.",
                        null
                ));
    }

    /**
     * Handles rate limiting.
     */
    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleRateLimit(
            RateLimitExceededException ex) {

        return ResponseEntity
                .status(HttpStatus.TOO_MANY_REQUESTS)
                .body(new ApiErrorResponse(
                        "Too many attempts. Try again later.",
                        null
                ));
    }

    // ============================================================
    // Duplicate / Data Integrity
    // ============================================================

    /**
     * Handles application-level duplicate field validation.
     */
    @ExceptionHandler(DuplicateFieldException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateField(
            DuplicateFieldException ex) {

        Map<String, String> fieldErrors =
                Map.of(ex.getField(), ex.getMessage());

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ApiErrorResponse(
                        ex.getMessage(),
                        fieldErrors
                ));
    }

    /**
     * Handles database unique constraint violations.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrityViolation(
            DataIntegrityViolationException ex) {

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ApiErrorResponse(
                        "This record conflicts with data that already exists. "
                                + "Please check your input and try again.",
                        null
                ));
    }

    // ============================================================
    // Organization / Tenant
    // ============================================================

    /**
     * Handles organizations that cannot be found.
     */
    @ExceptionHandler(OrganizationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleOrganizationNotFound(
            OrganizationNotFoundException ex) {

        return ResponseEntity
                .status(HttpStatus.NOT_FOUND)
                .body(new ApiErrorResponse(
                        ex.getMessage(),
                        null
                ));
    }

    /**
     * Handles operations against suspended organizations.
     */
    @ExceptionHandler(OrganizationSuspendedException.class)
    public ResponseEntity<ApiErrorResponse> handleOrganizationSuspended(
            OrganizationSuspendedException ex) {

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ApiErrorResponse(
                        ex.getMessage(),
                        null
                ));
    }

    /**
     * Handles requests where the target user is not an organization admin.
     */
    @ExceptionHandler(NotAnOrgAdminException.class)
    public ResponseEntity<ApiErrorResponse> handleNotAnOrgAdmin(
            NotAnOrgAdminException ex) {

        return ResponseEntity
                .badRequest()
                .body(new ApiErrorResponse(
                        ex.getMessage(),
                        null
                ));
    }

    /**
     * Prevents removal of the final organization administrator.
     */
    @ExceptionHandler(LastRemainingAdminException.class)
    public ResponseEntity<ApiErrorResponse> handleLastRemainingAdmin(
            LastRemainingAdminException ex) {

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ApiErrorResponse(
                        ex.getMessage(),
                        null
                ));
    }

    // ============================================================
    // Foundation Module
    // ============================================================

    /**
     * Handles foundation-module business exceptions.
     *
     * <p>
     * FoundationModuleException represents a conflict with the current
     * platform state, therefore HTTP 409 CONFLICT is returned.
     */
    @ExceptionHandler(FoundationModuleException.class)
    public ResponseEntity<ApiErrorResponse> handleFoundationModule(
            FoundationModuleException ex) {

        return ResponseEntity
                .status(HttpStatus.CONFLICT)
                .body(new ApiErrorResponse(
                        ex.getMessage(),
                        null
                ));
    }

    // ============================================================
    // File Upload
    // ============================================================

    /**
     * Handles invalid file types.
     */
    @ExceptionHandler(InvalidFileTypeException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidFileType(
            InvalidFileTypeException ex) {

        return ResponseEntity
                .badRequest()
                .body(new ApiErrorResponse(
                        ex.getMessage(),
                        null
                ));
    }

    /**
     * Handles IO failures during file uploads.
     */
    @ExceptionHandler(UncheckedIOException.class)
    public ResponseEntity<ApiErrorResponse> handleUncheckedIO(
            UncheckedIOException ex) {

        return ResponseEntity
                .badRequest()
                .body(new ApiErrorResponse(
                        "Upload failed. Please try again.",
                        null
                ));
    }

    // ============================================================
    // Spring MVC Validation
    // ============================================================

    /**
     * Handles @Valid / @Validated request validation failures.
     */
    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {

        Map<String, String> fieldErrors =
                ex.getBindingResult()
                        .getFieldErrors()
                        .stream()
                        .collect(Collectors.toMap(
                                FieldError::getField,
                                fieldError ->
                                        fieldError.getDefaultMessage() != null
                                                ? fieldError.getDefaultMessage()
                                                : "Invalid value",
                                (first, second) -> first,
                                HashMap::new
                        ));

        return ResponseEntity
                .status(status)
                .headers(headers)
                .body(new ApiErrorResponse(
                        "Validation failed",
                        fieldErrors
                ));
    }

    /**
     * Handles malformed JSON and invalid request body values.
     */
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {

        return ResponseEntity
                .status(status)
                .headers(headers)
                .body(new ApiErrorResponse(
                        "Request body is invalid or malformed.",
                        null
                ));
    }

    /**
     * Handles missing multipart request parts.
     */
    @Override
    protected ResponseEntity<Object> handleMissingServletRequestPart(
            MissingServletRequestPartException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {

        return ResponseEntity
                .status(status)
                .headers(headers)
                .body(new ApiErrorResponse(
                        "Request is missing a required part.",
                        null
                ));
    }

    /**
     * Handles files exceeding the configured upload size.
     */
    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex,
            HttpHeaders headers,
            HttpStatusCode status,
            WebRequest request) {

        return ResponseEntity
                .status(HttpStatus.PAYLOAD_TOO_LARGE)
                .headers(headers)
                .body(new ApiErrorResponse(
                        "File is too large. Maximum size is 5MB.",
                        null
                ));
    }

    // ============================================================
    // Spring MVC Generic Exception Handling
    // ============================================================

    /**
     * Provides a consistent response for Spring MVC exceptions that are
     * already handled internally by ResponseEntityExceptionHandler.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex,
            @Nullable Object body,
            HttpHeaders headers,
            HttpStatusCode statusCode,
            WebRequest request) {

        return ResponseEntity
                .status(statusCode)
                .headers(headers)
                .body(new ApiErrorResponse(
                        "Request could not be processed.",
                        null
                ));
    }

    // ============================================================
    // Catch-All
    // ============================================================

    /**
     * Final safety net for unexpected application exceptions.
     *
     * <p>
     * The full exception is logged server-side while the client receives
     * a generic message so that internal implementation details are not
     * exposed.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(
            Exception ex) {

        log.error("Unhandled exception", ex);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse(
                        "Something went wrong. Please try again.",
                        null
                ));
    }
}