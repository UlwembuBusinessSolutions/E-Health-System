package co.ehealth.platform.patient;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class PatientReferralNotFoundException extends RuntimeException {
    public PatientReferralNotFoundException() {
        super("Referral not found.");
    }
}
