package co.ehealth.platform.core.common;

import co.ehealth.platform.core.security.InvalidTokenException;
import co.ehealth.platform.identity.AccountLockedException;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.InvalidCredentialsException;
import co.ehealth.platform.identity.InvalidResetCodeException;
import co.ehealth.platform.identity.LastRemainingAdminException;
import co.ehealth.platform.identity.NotAnOrgAdminException;
import co.ehealth.platform.identity.NotAuthorizedException;
import co.ehealth.platform.identity.RateLimitExceededException;
import co.ehealth.platform.platform.FoundationModuleException;
import co.ehealth.platform.platform.LastActiveOperatorException;
import co.ehealth.platform.platform.OrganizationNotFoundException;
import co.ehealth.platform.platform.OrganizationSuspendedException;
import co.ehealth.platform.platform.PlatformOperatorNotFoundException;
import co.ehealth.platform.patient.InvalidIdNumberException;
import co.ehealth.platform.patient.PatientNotFoundException;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.pharmacy.NotLicensedException;
import co.ehealth.platform.pharmacy.PrescriptionAlreadyDispensedException;
import co.ehealth.platform.pharmacy.PrescriptionNotFoundException;
import co.ehealth.platform.visit.EmptyQueueException;
import co.ehealth.platform.visit.VisitNotFoundException;
import co.ehealth.platform.patient.ReasonForChangeRequiredException;

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

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidCredentials(InvalidCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse("Incorrect email or password.", null));
    }

    @ExceptionHandler(AccountLockedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountLocked(AccountLockedException ex) {
        // Unlike InvalidCredentialsException,
        return ResponseEntity.status(423)
                .header("Retry-After", String.valueOf(ex.getRetryAfterSeconds()))
                .body(new ApiErrorResponse("Too many failed attempts. Try again in a few minutes.", null));
    }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidToken(InvalidTokenException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse("Session expired. Please sign in again.", null));
    }

    @ExceptionHandler(InvalidResetCodeException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidResetCode(InvalidResetCodeException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse("Incorrect or expired code.", null));
    }

    @ExceptionHandler(DuplicateFieldException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateField(DuplicateFieldException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ApiErrorResponse(ex.getMessage(), Map.of(ex.getField(), ex.getMessage())));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(
                "This record conflicts with data that already exists. Please check your input and try again.",
                null));
    }

    @ExceptionHandler(RateLimitExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleRateLimit(RateLimitExceededException ex) {
        return ResponseEntity.status(429).body(new ApiErrorResponse("Too many attempts. Try again later.", null));
    }

    @ExceptionHandler(OrganizationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleOrganizationNotFound(OrganizationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(OrganizationSuspendedException.class)
    public ResponseEntity<ApiErrorResponse> handleOrganizationSuspended(OrganizationSuspendedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(NotAnOrgAdminException.class)
    public ResponseEntity<ApiErrorResponse> handleNotAnOrgAdmin(NotAnOrgAdminException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(LastRemainingAdminException.class)
    public ResponseEntity<ApiErrorResponse> handleLastRemainingAdmin(LastRemainingAdminException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(FoundationModuleException.class)
    public ResponseEntity<ApiErrorResponse> handleFoundationModule(FoundationModuleException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(InvalidFileTypeException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidFileType(InvalidFileTypeException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // PlatformOperatorService.resetPassword()/setEnabled() — the target
    // {id} doesn't exist. Same shape as OrganizationNotFoundException above.
    @ExceptionHandler(PlatformOperatorNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePlatformOperatorNotFound(PlatformOperatorNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // PlatformOperatorService.setEnabled()'s own guard — disabling the last
    // ACTIVE operator would lock every human out of the platform console
    // with no recovery path. Same "conflicts with current state" reasoning
    // as LastRemainingAdminException above.
    @ExceptionHandler(LastActiveOperatorException.class)
    public ResponseEntity<ApiErrorResponse> handleLastActiveOperator(LastActiveOperatorException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // SouthAfricanIdNumber.parse() — a well-formed 13-digit string that
    // still fails its check digit or doesn't decode to a real calendar
    // date. A client input problem, not a server error.
    @ExceptionHandler(InvalidIdNumberException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidIdNumber(InvalidIdNumberException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // PatientService.update()'s AC3 guard — a clinically significant field
    // changed with no reason supplied.
    @ExceptionHandler(ReasonForChangeRequiredException.class)
    public ResponseEntity<ApiErrorResponse> handleReasonForChangeRequired(ReasonForChangeRequiredException ex) {
        return ResponseEntity.badRequest()
                .body(new ApiErrorResponse(ex.getMessage(), Map.of("reasonForChange", ex.getMessage())));
    }

    @ExceptionHandler(PatientNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientNotFound(PatientNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(FacilityNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleFacilityNotFound(FacilityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(VisitNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleVisitNotFound(VisitNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // QueueService.callNext() against an empty queue — the facility and
    // request are both valid, the current state just has no one to call.
    // Same "conflicts with current state" shape as LastRemainingAdminException/
    // OrganizationSuspendedException above.
    @ExceptionHandler(EmptyQueueException.class)
    public ResponseEntity<ApiErrorResponse> handleEmptyQueue(EmptyQueueException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // PHRM-US-009 — the acting user lacks a current, non-expired
    // professional registration for the action they're attempting. 403,
    // not 409/401: they're correctly authenticated and the target resource
    // is fine, they personally just aren't credentialed for this action.
    @ExceptionHandler(NotLicensedException.class)
    public ResponseEntity<ApiErrorResponse> handleNotLicensed(NotLicensedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(NotAuthorizedException.class)
    public ResponseEntity<ApiErrorResponse> handleNotAuthorized(NotAuthorizedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PrescriptionNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePrescriptionNotFound(PrescriptionNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PrescriptionAlreadyDispensedException.class)
    public ResponseEntity<ApiErrorResponse> handlePrescriptionAlreadyDispensed(
            PrescriptionAlreadyDispensedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(UncheckedIOException.class)
    public ResponseEntity<ApiErrorResponse> handleUncheckedIO(UncheckedIOException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse("Upload failed. Please try again.", null));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        Map<String, String> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField,
                        fe -> fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value",
                        (a, b) -> a, HashMap::new));
        return ResponseEntity.status(status).headers(headers)
                .body(new ApiErrorResponse("Validation failed", fieldErrors));
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(status).headers(headers)
                .body(new ApiErrorResponse("Request body is invalid or malformed.", null));
    }

    @Override
    protected ResponseEntity<Object> handleMissingServletRequestPart(MissingServletRequestPartException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(status).headers(headers)
                .body(new ApiErrorResponse("Request is missing a required part.", null));
    }

    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(MaxUploadSizeExceededException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(413).headers(headers)
                .body(new ApiErrorResponse("File is too large. Maximum size is 5MB.", null));
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body,
            HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        return ResponseEntity.status(statusCode).headers(headers)
                .body(new ApiErrorResponse("Request could not be processed.", null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse("Something went wrong. Please try again.", null));
    }
}
