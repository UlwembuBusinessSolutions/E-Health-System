package co.ehealth.platform.core.notification;

import java.util.List;

/** Template definitions from the Ulwembu WhatsApp template catalogue. */
public enum WhatsAppMessageTemplate {
    MEDICATION_READY("ulwembu_medication_ready", List.of("patient_first_name", "collection_location", "collection_reference", "collection_by", "collection_hours", "clinic_name"), false),
    MEDICATION_COLLECTION_REMINDER("ulwembu_medication_collection_reminder", List.of("patient_first_name", "collection_location", "collection_reference", "collection_by", "collection_hours", "clinic_name"), false),
    MEDICATION_COLLECTION_OVERDUE("ulwembu_medication_collection_overdue", List.of("patient_first_name", "collection_reference", "collection_location"), false),
    MEDICATION_PARTIALLY_READY("ulwembu_medication_partially_ready", List.of("patient_first_name", "collection_location", "collection_reference"), false),
    MEDICATION_DELAYED("ulwembu_medication_delayed", List.of("patient_first_name", "collection_location", "collection_reference"), false),
    MEDICATION_COLLECTED("ulwembu_medication_collected", List.of("patient_first_name", "collection_location", "collection_reference", "collection_date", "collection_time"), false),
    MEDICATION_COLLECTION_CHANGED("ulwembu_medication_collection_changed", List.of("patient_first_name", "collection_reference", "collection_location", "collection_address", "collection_hours", "collection_by"), false),
    REPEAT_PRESCRIPTION_REVIEW("ulwembu_repeat_prescription_review", List.of("patient_first_name", "review_by", "clinic_name"), false),
    APPOINTMENT_CONFIRMED("ulwembu_appointment_confirmed", List.of("patient_first_name", "appointment_date", "appointment_time", "time_zone", "facility_name", "facility_address", "appointment_reference"), false),
    APPOINTMENT_REMINDER("ulwembu_appointment_reminder", List.of("patient_first_name", "appointment_date", "appointment_time", "time_zone", "facility_name", "appointment_reference", "arrival_instruction"), false),
    APPOINTMENT_TODAY("ulwembu_appointment_today", List.of("patient_first_name", "appointment_time", "time_zone", "facility_name", "facility_address", "appointment_reference"), false),
    APPOINTMENT_RESCHEDULED("ulwembu_appointment_rescheduled", List.of("patient_first_name", "appointment_date", "appointment_time", "time_zone", "facility_name", "appointment_reference"), false),
    APPOINTMENT_CANCELLED("ulwembu_appointment_cancelled", List.of("patient_first_name", "appointment_date", "appointment_time", "time_zone", "facility_name", "appointment_reference"), false),
    APPOINTMENT_MISSED("ulwembu_appointment_missed", List.of("patient_first_name", "appointment_date", "facility_name", "appointment_reference"), false),
    APPOINTMENT_REQUEST_RECEIVED("ulwembu_appointment_request_received", List.of("patient_first_name", "clinic_name", "appointment_reference"), false),
    APPOINTMENT_WAITLIST_OFFER("ulwembu_appointment_waitlist_offer", List.of("patient_first_name", "facility_name", "appointment_date", "appointment_time", "time_zone", "reply_by"), false),
    VISIT_CHECKED_IN("ulwembu_visit_checked_in", List.of("patient_first_name", "facility_name", "queue_token", "check_in_time"), false),
    QUEUE_CALLED("ulwembu_queue_called", List.of("patient_first_name", "queue_token", "facility_name", "service_point"), false),
    FOLLOW_UP_REQUESTED("ulwembu_follow_up_requested", List.of("patient_first_name", "follow_up_by", "clinic_name"), false),
    RESULTS_AVAILABLE("ulwembu_results_available", List.of("patient_first_name", "clinic_name"), false),
    SECURE_MESSAGE("ulwembu_secure_message", List.of("patient_first_name", "clinic_name"), false),
    PATIENT_WELCOME("ulwembu_patient_welcome", List.of("patient_first_name", "clinic_name", "patient_reference"), false),
    PATIENT_VERIFICATION_CODE("ulwembu_patient_verification_code", List.of("verification_code"), true),
    PASSWORD_RESET_CODE("ulwembu_password_reset_code", List.of("verification_code"), true),
    PASSWORD_CHANGED("ulwembu_password_changed", List.of("clinic_name", "changed_at"), false),
    PATIENT_TRANSFER("ulwembu_patient_transfer", List.of("patient_first_name", "destination_clinic", "destination_address", "patient_reference"), false),
    STAFF_ACCOUNT_CREATED("ulwembu_staff_account_created", List.of("staff_first_name", "clinic_name", "staff_email", "staff_role"), false),
    STAFF_PASSWORD_RESET("ulwembu_staff_password_reset", List.of("staff_first_name", "clinic_name"), false),
    PRESCRIBER_QUERY("ulwembu_prescriber_query", List.of("staff_first_name", "clinic_name", "prescription_reference", "query_reference"), false),
    ORGANISATION_ADMIN_WELCOME("ulwembu_organisation_admin_welcome", List.of("staff_first_name", "clinic_name"), false),
    PLATFORM_OPERATOR_WELCOME("ulwembu_platform_operator_welcome", List.of("staff_first_name", "platform_name"), false),
    NEW_SIGN_IN("ulwembu_new_sign_in", List.of("clinic_name", "sign_in_time", "device_description"), false);

    private final String templateName;
    private final List<String> parameters;
    private final boolean authentication;

    WhatsAppMessageTemplate(String templateName, List<String> parameters, boolean authentication) {
        this.templateName = templateName;
        this.parameters = parameters;
        this.authentication = authentication;
    }

    public String templateName() { return templateName; }
    public List<String> parameters() { return parameters; }
    public boolean authentication() { return authentication; }
}
