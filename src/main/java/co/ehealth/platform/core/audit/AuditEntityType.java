package co.ehealth.platform.core.audit;


public enum AuditEntityType {

    // ==========================
    // PLATFORM
    // ==========================
    TENANT,
    CLINIC,
    MODULE,
    MODULE_ENTITLEMENT,
    TENANT_ADMIN,
    BRANDING,

    // ==========================
    // IDENTITY & ACCESS MANAGEMENT
    // ==========================
    USER,
    ROLE,
    PERMISSION,
    USER_SESSION,

    // ==========================
    // PATIENT MANAGEMENT
    // ==========================
    PATIENT,
    PATIENT_VISIT,
    PATIENT_DOCUMENT,

    // ==========================
    // APPOINTMENTS
    // ==========================
    APPOINTMENT,
    SCHEDULE,

    // ==========================
    // CLINICAL
    // ==========================
    ENCOUNTER,
    DIAGNOSIS,
    PRESCRIPTION,
    LAB_RESULT,
    REFERRAL,
    VITAL_SIGNS,
    TREATMENT_PLAN,

    // ==========================
    // PHARMACY
    // ==========================
    MEDICATION,
    DISPENSE_RECORD,

    // ==========================
    // INVENTORY
    // ==========================
    STOCK_ITEM,
    PROCUREMENT,
    SUPPLIER,

    // ==========================
    // BILLING
    // ==========================
    INVOICE,
    PAYMENT,

    // ==========================
    // REPORTING
    // ==========================
    REPORT,
    DASHBOARD,

    // ==========================
    // SYSTEM
    // ==========================
    AUTHENTICATION,
    CONFIGURATION,
    AUDIT_LOG,
    SYSTEM
}