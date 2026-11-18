package co.ehealth.platform.patient;

import co.ehealth.platform.core.common.ApiErrorResponse;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

// Module-local handler (same approach as AppointmentExceptionHandler) so GlobalExceptionHandler is untouched.
@RestControllerAdvice
@Order(-1)
public class PatientAllergyExceptionHandler {

    @ExceptionHandler(PatientAllergyNotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(PatientAllergyNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiErrorResponse(ex.getMessage(), null));
    }

    @ExceptionHandler(InvalidPatientAllergyException.class)
    public ResponseEntity<ApiErrorResponse> handleInvalid(InvalidPatientAllergyException ex) {
        return ResponseEntity.badRequest().body(new ApiErrorResponse(ex.getMessage(), null));
    }
}