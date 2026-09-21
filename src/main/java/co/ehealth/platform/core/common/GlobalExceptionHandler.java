package co.ehealth.platform.core.common;

import co.ehealth.platform.consultation.ConsultationNotFoundException;
import co.ehealth.platform.consultation.InvalidConsultationException;
import co.ehealth.platform.consultation.InvalidConsultationStateException;
import co.ehealth.platform.core.security.InvalidTokenException;
import co.ehealth.platform.identity.AccountLockedException;
import co.ehealth.platform.identity.DuplicateFieldException;
import co.ehealth.platform.identity.InvalidCredentialsException;
import co.ehealth.platform.identity.InvalidResetCodeException;
import co.ehealth.platform.identity.LastRemainingAdminException;
import co.ehealth.platform.identity.NotAnOrgAdminException;
import co.ehealth.platform.identity.NotAClinicalRoleException;
import co.ehealth.platform.identity.NotAuthorizedException;
import co.ehealth.platform.identity.RateLimitExceededException;
import co.ehealth.platform.platform.FoundationModuleException;
import co.ehealth.platform.platform.LastActiveOperatorException;
import co.ehealth.platform.platform.OrganizationNotFoundException;
import co.ehealth.platform.platform.OrganizationSuspendedException;
import co.ehealth.platform.platform.PlatformOperatorNotFoundException;
import co.ehealth.platform.patient.InvalidIdNumberException;
import co.ehealth.platform.patient.InvalidMigrationDestinationException;
import co.ehealth.platform.patient.MigrationNotFoundException;
import co.ehealth.platform.patient.PatientAlreadyArchivedException;
import co.ehealth.platform.patient.PatientAlreadyExistsAtDestinationException;
import co.ehealth.platform.patient.PatientArchivedException;
import co.ehealth.platform.patient.PatientDocumentNotFoundException;
import co.ehealth.platform.patient.PatientGuardianNotFoundException;
import co.ehealth.platform.patient.PatientNotFoundException;
import co.ehealth.platform.patient.TooManyGuardiansException;
import co.ehealth.platform.facility.FacilityNotFoundException;
import co.ehealth.platform.facility.PharmacyFacilityNotConfiguredException;
import co.ehealth.platform.pharmacy.NotLicensedException;
import co.ehealth.platform.pharmacy.PrescriptionAlreadyDispensedException;
import co.ehealth.platform.pharmacy.InvalidPrescriberMessageException;
import co.ehealth.platform.pharmacy.PrescriptionItemNotFoundException;
import co.ehealth.platform.pharmacy.PrescriptionNotFoundException;
import co.ehealth.platform.visit.EmptyQueueException;
import co.ehealth.platform.visit.InvalidTokenTransitionException;
import co.ehealth.platform.visit.InvalidQueueReasonException;
import co.ehealth.platform.visit.InvalidTransferException;
import co.ehealth.platform.visit.QueueTokenNotFoundException;
import co.ehealth.platform.visit.VisitNotFoundException;
import co.ehealth.platform.triage.InvalidTriageCaptureException;
import co.ehealth.platform.triage.TriageAssessmentNotFoundException;
import co.ehealth.platform.pharmacy.stock.BatchExpiryConflictException;
import co.ehealth.platform.pharmacy.stock.DuplicateProductCodeException;
import co.ehealth.platform.pharmacy.stock.IdempotencyConflictException;
import co.ehealth.platform.pharmacy.stock.InsufficientStockException;
import co.ehealth.platform.pharmacy.stock.MissingExpiryException;
import co.ehealth.platform.pharmacy.stock.PharmacyProductNotFoundException;
import co.ehealth.platform.pharmacy.stock.ProductArchivedException;
import co.ehealth.platform.pharmacy.stock.ProductHasStockException;
import co.ehealth.platform.pharmacy.stock.ProductNotStockedAtFacilityException;
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

// One handler, one response shape — matching the frontend's ApiError class
// (message, optional fieldErrors) exactly, so client error-rendering code
// needs no per-endpoint special-casing. The 419 idle-lock response is the
// one exception: it's written directly by IdleLockFilter, never reaches
// this handler.
//
// Extends ResponseEntityExceptionHandler, not just @RestControllerAdvice on
// a bare class — deliberately, and only added after the pattern became
// impossible to ignore. Every one of the Spring-framework exceptions below
// was found the same way: real testing turned up something that fires
// before the controller method ever runs, which this class had no handler
// for, so it fell through to the generic 500 at the bottom. Rather than
// keep adding one @ExceptionHandler at a time as each new one gets found,
// this extends the base class Spring itself provides for exactly this
// situation — it already recognizes ~20 of these framework exceptions
// (wrong HTTP method, unsupported content type, a missing request
// parameter, and more) and exposes a protected, overridable hook method
// per exception type, plus one shared handleExceptionInternal() every hook
// eventually calls. Overriding that shared method once means the *next*
// undiscovered one is already covered instead of waiting to be found the
// same way this whole list was.
//
// One real wrinkle from doing this: the specific hooks below (
// handleMethodArgumentNotValid, handleHttpMessageNotReadable, etc.) are
// the ONLY way to customize behavior for exception types the base class
// already owns — declaring a sibling @ExceptionHandler for the same exact
// type (as this class originally did) makes Spring refuse to start at all
// ("Ambiguous @ExceptionHandler method"), since the base class's own
// internal dispatch method is already mapped to that type too and Spring
// has no tiebreak for two equally-specific matches. Found by trying it the
// wrong way first: extending the base class while keeping the old
// MethodArgumentNotValidException, MaxUploadSizeExceededException,
// HttpMessageNotReadableException, and MissingServletRequestPartException
// handlers crashed the app on startup, one exception at a time, until all
// four were converted to overrides instead.
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidCredentials(InvalidCredentialsException ex) {
        // Identical message whether the email is unknown or the password is
        // wrong — the enumeration guard only works if the 401 body can't be
        // used to tell those two cases apart either.
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse("Incorrect email or password.", null));
    }

    @ExceptionHandler(AccountLockedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccountLocked(AccountLockedException ex) {
        // Unlike InvalidCredentialsException, this one is allowed to be
        // specific — the account's existence isn't in question at this
        // point, only its lockout state, so telling the caller how long is
        // useful UX rather than an enumeration leak.
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

    // A unique-constraint violation that slipped past the application-level
    // requireUnique()-style check — that check and the INSERT that follows
    // it aren't atomic with each other, so two requests for the same
    // email/employeeNumber/contactNumber landing close enough together can
    // both pass the check and only one win at the database. Same
    // "conflicts with current state" reasoning as DuplicateFieldException
    // above, just reached via a narrow timing window instead of the normal
    // path — confirmed with a real race (two simultaneous identical staff-
    // creation requests, and separately two simultaneous provisionOrganization()
    // calls for the same slug): the loser got a bare 500 before this handler
    // existed. No specific field name here, unlike DuplicateFieldException
    // — parsing one out of the constraint name is more fragile than it's
    // worth for what should be a rare path in practice.
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

    // Replaces a generic IllegalArgumentException that four
    // OrganizationProvisioningService methods (getOrganization, addAdmins,
    // suspend, reactivate) threw for an unknown {id} — uncaught, all four
    // fell through to this class's own catch-all Exception handler below
    // and returned a bare 500 instead of a clean, accurate 404. Found by
    // reviewing the organization lifecycle end to end, not by a failing
    // request — confirmed by testing afterward: GET against a real but
    // nonexistent organization id now returns 404, not 500.
    @ExceptionHandler(OrganizationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleOrganizationNotFound(OrganizationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // Same discovery, same fix shape: addAdmins() against a SUSPENDED
    // organization threw a generic IllegalStateException, also uncaught,
    // also a bare 500. "Conflicts with current state" is precisely what
    // 409 means here — the organization exists, the request is otherwise
    // well-formed, it just can't happen while suspended.
    @ExceptionHandler(OrganizationSuspendedException.class)
    public ResponseEntity<ApiErrorResponse> handleOrganizationSuspended(OrganizationSuspendedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // StaffService.revokeOrgAdminRole() — the target {userId} exists but
    // doesn't currently hold ORG_ADMIN (wrong id, or already revoked by a
    // concurrent call). A client input problem, not a server error.
    @ExceptionHandler(NotAnOrgAdminException.class)
    public ResponseEntity<ApiErrorResponse> handleNotAnOrgAdmin(NotAnOrgAdminException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // The safety check in the same method: refusing to remove an
    // organization's last remaining admin, since every endpoint that could
    // add another one back requires ORG_ADMIN to call it in the first
    // place. Same "conflicts with current state" reasoning as
    // OrganizationSuspendedException above.
    @ExceptionHandler(LastRemainingAdminException.class)
    public ResponseEntity<ApiErrorResponse> handleLastRemainingAdmin(LastRemainingAdminException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // SADM-US-010's Foundation-module protection — the module exists and
    // the organization exists, the request is just structurally not
    // allowed, same "conflicts with current state" shape as
    // OrganizationSuspendedException above.
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

    @ExceptionHandler(PatientNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientNotFound(PatientNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PatientDocumentNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientDocumentNotFound(PatientDocumentNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PatientGuardianNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientGuardianNotFound(PatientGuardianNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(TooManyGuardiansException.class)
    public ResponseEntity<ApiErrorResponse> handleTooManyGuardians(TooManyGuardiansException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // 409 for both — the request is well-formed, but rejected because of the
    // patient's current archived state, not because of anything wrong with
    // the request body itself.
    @ExceptionHandler(PatientArchivedException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientArchived(PatientArchivedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PatientAlreadyArchivedException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientAlreadyArchived(PatientAlreadyArchivedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // PatientMigrationService — the chosen destination organization/facility
    // isn't available (unknown, suspended, or the caller's own tenant). A
    // client input problem, not a server error.
    @ExceptionHandler(InvalidMigrationDestinationException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidMigrationDestination(InvalidMigrationDestinationException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // PatientMigrationService.getDestinationView() — this patient exists but
    // was never migrated out. Same shape as PatientNotFoundException.
    @ExceptionHandler(MigrationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleMigrationNotFound(MigrationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // PatientMigrationWriter.writeDestination() — a specific, actionable
    // message in place of the generic DataIntegrityViolationException 409
    // this would otherwise fall through to on the id_number UNIQUE
    // constraint (this handler runs first since it's the more specific
    // type).
    @ExceptionHandler(PatientAlreadyExistsAtDestinationException.class)
    public ResponseEntity<ApiErrorResponse> handlePatientAlreadyExistsAtDestination(
            PatientAlreadyExistsAtDestinationException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(FacilityNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleFacilityNotFound(FacilityNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PharmacyFacilityNotConfiguredException.class)
    public ResponseEntity<ApiErrorResponse> handlePharmacyFacilityNotConfigured(
            PharmacyFacilityNotConfiguredException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
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

    // QueueService's transition methods (markMissed/recall/complete/
    // cancel) — the target tokenId doesn't exist. Same shape as
    // VisitNotFoundException above.
    @ExceptionHandler(QueueTokenNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleQueueTokenNotFound(QueueTokenNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // QueueToken's transition guards — e.g. recalling a token that was
    // never MISSED, or completing one that was never CALLED. Same
    // "conflicts with current state" shape as EmptyQueueException above.
    @ExceptionHandler(InvalidTokenTransitionException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidTokenTransition(InvalidTokenTransitionException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(InvalidQueueReasonException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidQueueReason(InvalidQueueReasonException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // QueueService.transferToken() — destination facility chosen is the same
    // one the token is already at.
    @ExceptionHandler(InvalidTransferException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidTransfer(InvalidTransferException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // PHRM-US-009 — the acting user lacks a current, non-expired
    // professional registration for the action they're attempting. 403,
    // not 409/401: they're correctly authenticated and the target resource
    // is fine, they personally just aren't credentialed for this action.
    @ExceptionHandler(NotLicensedException.class)
    public ResponseEntity<ApiErrorResponse> handleNotLicensed(NotLicensedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // IAM-US-009 AC3 — a role/module combination marked no-access gets
    // exactly this, never an empty list or a 404 (FRS Section 3.2's own
    // distinction between NOT_AUTHORISED and NOT_FOUND).
    @ExceptionHandler(NotAuthorizedException.class)
    public ResponseEntity<ApiErrorResponse> handleNotAuthorized(NotAuthorizedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // TriageService — holds RECQ:MANAGE but isn't one of the specific
    // clinical roles allowed to capture/correct triage data (a Queue
    // Marshall or Admin Staff, say). Same 403 shape as NotAuthorizedException
    // above, same reasoning: a role mismatch, not a missing resource.
    @ExceptionHandler(NotAClinicalRoleException.class)
    public ResponseEntity<ApiErrorResponse> handleNotAClinicalRole(NotAClinicalRoleException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(TriageAssessmentNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleTriageAssessmentNotFound(TriageAssessmentNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // TriageService's capture-time validation — an emergency capture with
    // no note, an incomplete non-emergency vitals set, or a correction
    // targeting the wrong/already-resolved assessment. A client input
    // problem, not a server error, same shape as InvalidQueueReasonException.
    @ExceptionHandler(InvalidTriageCaptureException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidTriageCapture(InvalidTriageCaptureException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PrescriptionNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePrescriptionNotFound(PrescriptionNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PrescriptionItemNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePrescriptionItemNotFound(PrescriptionItemNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(InvalidPrescriberMessageException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidPrescriberMessage(InvalidPrescriberMessageException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PrescriptionAlreadyDispensedException.class)
    public ResponseEntity<ApiErrorResponse> handlePrescriptionAlreadyDispensed(
            PrescriptionAlreadyDispensedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(ConsultationNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleConsultationNotFound(ConsultationNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // ConsultationService's input validation — blank diagnosis text, a
    // sign()/amend() call missing a required field. A client input
    // problem, not a server error, same shape as InvalidTriageCaptureException.
    @ExceptionHandler(InvalidConsultationException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidConsultation(InvalidConsultationException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // ConsultationService's lifecycle-state guards — editing a consultation
    // that's no longer a draft, or amending/entering-in-error one that
    // isn't currently signed. Same "conflicts with current state" shape as
    // PrescriptionAlreadyDispensedException above.
    @ExceptionHandler(InvalidConsultationStateException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalidConsultationState(InvalidConsultationStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // Pharmacy stock ledger, Phase 1 (co.ehealth.platform.pharmacy.stock) —
    // see Docs/pharmacy-stock-ledger-plan.md.
    @ExceptionHandler(DuplicateProductCodeException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicateProductCode(DuplicateProductCodeException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(PharmacyProductNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handlePharmacyProductNotFound(PharmacyProductNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(ProductArchivedException.class)
    public ResponseEntity<ApiErrorResponse> handleProductArchived(ProductArchivedException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(ProductHasStockException.class)
    public ResponseEntity<ApiErrorResponse> handleProductHasStock(ProductHasStockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(ProductNotStockedAtFacilityException.class)
    public ResponseEntity<ApiErrorResponse> handleProductNotStockedAtFacility(
            ProductNotStockedAtFacilityException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(BatchExpiryConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleBatchExpiryConflict(BatchExpiryConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(MissingExpiryException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingExpiry(MissingExpiryException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<ApiErrorResponse> handleInsufficientStock(InsufficientStockException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(IdempotencyConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleIdempotencyConflict(IdempotencyConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    // StaffPhotoService.uploadPhoto() wraps a checked IOException from
    // file.getInputStream() in this — a client that disconnects mid-upload
    // or sends a truncated multipart body, not a server malfunction. This
    // is the caller's problem (retry the upload), so it gets its own 400.
    // Application-thrown, not one of ResponseEntityExceptionHandler's own
    // exceptions, so a plain @ExceptionHandler is fine here — no ambiguity.
    @ExceptionHandler(UncheckedIOException.class)
    public ResponseEntity<ApiErrorResponse> handleUncheckedIO(UncheckedIOException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse("Upload failed. Please try again.", null));
    }

    // Everything below overrides a protected hook ResponseEntityExceptionHandler
    // already owns, rather than declaring a competing @ExceptionHandler —
    // see the class-level comment for why that distinction is required, not
    // stylistic.

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

    // Jackson throws this when it can't turn the request body into the
    // target type — most commonly an enum field holding a value that isn't
    // one of its constants (e.g. gender: "INVALID_GENDER"), or malformed
    // JSON outright. Confirmed by testing: an invalid Gender value was
    // returning a generic 500 instead of a 400 before this class handled
    // it at all.
    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(HttpMessageNotReadableException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(status).headers(headers)
                .body(new ApiErrorResponse("Request body is invalid or malformed.", null));
    }

    // StaffController.uploadPhoto() requires a multipart part named "file"
    // — a request that omits it entirely throws this before the controller
    // method runs. Confirmed by testing: a multipart request with a
    // differently-named part returned 500 before this was added.
    @Override
    protected ResponseEntity<Object> handleMissingServletRequestPart(MissingServletRequestPartException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(status).headers(headers)
                .body(new ApiErrorResponse("Request is missing a required part.", null));
    }

    // Thrown by Spring itself, before StaffPhotoService.uploadPhoto() ever
    // runs, once a request exceeds spring.servlet.multipart.max-file-size
    // — never something application code raises directly.
    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(MaxUploadSizeExceededException ex,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(413).headers(headers)
                .body(new ApiErrorResponse("File is too large. Maximum size is 5MB.", null));
    }

    // The safety net described in the class-level comment. Every other
    // exception ResponseEntityExceptionHandler's own dispatch table covers,
    // and that doesn't have its own override above, lands here — wrong
    // HTTP method (405), unsupported/unacceptable content type (415/406),
    // a missing request parameter (400), a path variable of the wrong type
    // (400), and the rest of that list. Confirmed by testing before this
    // existed: DELETE against a login endpoint, and POST with an
    // unsupported Content-Type, both returned a bare 500. Spring's own
    // default body here is a ProblemDetail (RFC 7807: type/title/status/
    // detail) — this guide's error contract is { message, fieldErrors },
    // so the body still needs remapping even though the status code Spring
    // already chose is worth keeping as-is.
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception ex, @Nullable Object body,
            HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        return ResponseEntity.status(statusCode).headers(headers)
                .body(new ApiErrorResponse("Request could not be processed.", null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception ex) {
        // Deliberately generic in the response — never echo exception
        // internals to the client — but logged in full server-side.
        // Without this log line, anything that falls through to this
        // handler is completely invisible: the client just sees "something
        // went wrong" and there's no trace anywhere of what actually
        // happened, which is exactly how several of the gaps above went
        // unnoticed until a real request hit them.
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse("Something went wrong. Please try again.", null));
    }
}
