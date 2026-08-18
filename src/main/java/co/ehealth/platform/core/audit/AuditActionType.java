package co.ehealth.platform.core.audit;


public enum AuditActionType {

    // ==========================
    // TENANT
    // ==========================
    TENANT_CREATED,
    TENANT_UPDATED,
    TENANT_ACTIVATED,
    TENANT_SUSPENDED,
    TENANT_DEACTIVATED,
    TENANT_DELETED,

    // ==========================
    // CLINIC
    // ==========================
    CLINIC_CREATED,
    CLINIC_UPDATED,
    CLINIC_ACTIVATED,
    CLINIC_SUSPENDED,
    CLINIC_DEACTIVATED,
    CLINIC_DELETED,

    // ==========================
    // MODULES
    // ==========================
    MODULE_ENABLED,
    MODULE_DISABLED,

    // ==========================
    // BRANDING
    // ==========================
    BRANDING_UPDATED,

    // ==========================
    // TENANT ADMINS
    // ==========================
    TENANT_ADMIN_CREATED,
    TENANT_ADMIN_UPDATED,
    TENANT_ADMIN_DELETED,

    // ==========================
    // AUTHENTICATION
    // ==========================
    LOGIN_SUCCESS,
    LOGIN_FAILED,
    LOGOUT_SUCCESS,
    REFRESH_TOKEN,
    PASSWORD_RESET_REQUESTED,
    PASSWORD_RESET_COMPLETED,

    // ==========================
    // SECURITY
    // ==========================
    ACCESS_DENIED,
    PASSWORD_CHANGED,
    ACCOUNT_LOCKED,
    ACCOUNT_UNLOCKED,
    MFA_ENABLED,
    MFA_DISABLED,

    // ==========================
    // USERS
    // ==========================
    USER_CREATED,
    USER_UPDATED,
    USER_DELETED,
    USER_ENABLED,
    USER_DISABLED,

    // ==========================
    // ROLES & PERMISSIONS
    // ==========================
    ROLE_CREATED,
    ROLE_UPDATED,
    ROLE_DELETED,
    PERMISSION_GRANTED,
    PERMISSION_REVOKED,

    // ==========================
    // SYSTEM
    // ==========================
    SYSTEM_CREATED,
    SYSTEM_UPDATED,
    SYSTEM_DELETED
}