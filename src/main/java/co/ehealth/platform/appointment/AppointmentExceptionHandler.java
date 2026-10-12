package co.ehealth.platform.appointment;

import co.ehealth.platform.core.common.ApiErrorResponse;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
@Order(-1)
public class AppointmentExceptionHandler {
    @ExceptionHandler(AppointmentException.class)
    public ResponseEntity<ApiErrorResponse> handle(AppointmentException ex) {
        return ResponseEntity.status(ex.status).body(new ApiErrorResponse(ex.getMessage(), null));
    }
}
