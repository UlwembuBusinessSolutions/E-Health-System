package co.ehealth.platform.pharmacy;
@org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.BAD_REQUEST)
public class InvalidDispenseException extends RuntimeException {
    public InvalidDispenseException(String message) { super(message); }
}
