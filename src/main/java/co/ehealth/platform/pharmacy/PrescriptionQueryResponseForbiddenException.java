package co.ehealth.platform.pharmacy;
public class PrescriptionQueryResponseForbiddenException extends RuntimeException { public PrescriptionQueryResponseForbiddenException() { super("Only the prescribing clinician can respond to this query."); } }
