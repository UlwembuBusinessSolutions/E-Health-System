import {
  Building2,
  Download,
  History,
  KeyRound,
  Layers3,
  ShieldAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export const AUDIT_GROUPS = [
  {
    label: "Organizations & clinics",
    actions: [
      "ORGANIZATION_PROVISIONED",
      "ORGANIZATION_DETAILS_UPDATED",
      "ORGANIZATION_SUSPENDED",
      "ORGANIZATION_REACTIVATED",
      "ORGANIZATION_LOGO_UPLOADED",
      "ORGANIZATION_MAIL_SETTINGS_UPDATED",
      "CLINIC_CREATED",
    ],
  },
  {
    label: "Administrators",
    actions: [
      "ORGANIZATION_ADMIN_ADDED",
      "ORGANIZATION_ADMIN_REMOVED",
      "ORGANIZATION_ADMIN_PASSWORD_RESET",
      "ORGANIZATION_ADMIN_ENABLED",
      "ORGANIZATION_ADMIN_DISABLED",
    ],
  },
  {
    label: "Platform operators",
    actions: [
      "PLATFORM_OPERATOR_CREATED",
      "PLATFORM_OPERATOR_PASSWORD_RESET",
      "PLATFORM_OPERATOR_ENABLED",
      "PLATFORM_OPERATOR_DISABLED",
    ],
  },
  {
    label: "Access & security",
    actions: [
      "PLATFORM_OPERATOR_LOGIN",
      "PLATFORM_OPERATOR_LOGIN_FAILED",
      "PLATFORM_OPERATOR_LOGIN_DENIED",
      "PLATFORM_OPERATOR_LOCKED",
    ],
  },
  {
    label: "Modules & exports",
    actions: [
      "MODULE_TOGGLED",
      "PLATFORM_AUDIT_EXPORTED",
      "ORGANIZATION_AUDIT_EXPORTED",
    ],
  },
];

const LABELS: Record<string, string> = {
  ORGANIZATION_PROVISIONED: "Organization created",
  ORGANIZATION_DETAILS_UPDATED: "Organization details updated",
  ORGANIZATION_SUSPENDED: "Organization suspended",
  ORGANIZATION_REACTIVATED: "Organization reactivated",
  ORGANIZATION_LOGO_UPLOADED: "Organization logo updated",
  ORGANIZATION_MAIL_SETTINGS_UPDATED: "Mail settings updated",
  CLINIC_CREATED: "Clinic created",
  ORGANIZATION_ADMIN_ADDED: "Administrator added",
  ORGANIZATION_ADMIN_REMOVED: "Administrator removed",
  ORGANIZATION_ADMIN_PASSWORD_RESET: "Administrator password reset",
  ORGANIZATION_ADMIN_ENABLED: "Administrator enabled",
  ORGANIZATION_ADMIN_DISABLED: "Administrator disabled",
  PLATFORM_OPERATOR_CREATED: "Operator created",
  PLATFORM_OPERATOR_PASSWORD_RESET: "Operator password reset",
  PLATFORM_OPERATOR_ENABLED: "Operator enabled",
  PLATFORM_OPERATOR_DISABLED: "Operator disabled",
  PLATFORM_OPERATOR_LOGIN: "Operator signed in",
  PLATFORM_OPERATOR_LOGIN_FAILED: "Sign-in failed",
  PLATFORM_OPERATOR_LOGIN_DENIED: "Sign-in denied",
  PLATFORM_OPERATOR_LOCKED: "Operator account locked",
  MODULE_TOGGLED: "Module configuration changed",
  PLATFORM_AUDIT_EXPORTED: "Platform audit exported",
  ORGANIZATION_AUDIT_EXPORTED: "Organization audit exported",
};
export function actionLabel(action: string): string {
  return (
    LABELS[action] ??
    action
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./, (letter) => letter.toUpperCase())
  );
}
export function actionAppearance(action: string): {
  icon: LucideIcon;
  category: string;
  attention: boolean;
} {
  if (
    [
      "PLATFORM_OPERATOR_LOGIN_FAILED",
      "PLATFORM_OPERATOR_LOGIN_DENIED",
      "PLATFORM_OPERATOR_LOCKED",
    ].includes(action)
  )
    return {
      icon: ShieldAlert,
      category: "Access & security",
      attention: true,
    };
  if (action.includes("LOGIN") || action.includes("PASSWORD"))
    return { icon: KeyRound, category: "Access & security", attention: false };
  if (action.endsWith("EXPORTED"))
    return { icon: Download, category: "Audit export", attention: false };
  if (action === "MODULE_TOGGLED")
    return {
      icon: Layers3,
      category: "Module configuration",
      attention: false,
    };
  if (action.includes("ADMIN") || action.includes("OPERATOR"))
    return {
      icon: UserRound,
      category: "Account management",
      attention: false,
    };
  if (action.startsWith("ORGANIZATION_") || action === "CLINIC_CREATED")
    return {
      icon: Building2,
      category: "Organization activity",
      attention: false,
    };
  return { icon: History, category: "Other activity", attention: false };
}
export function auditDate(iso: string, full = false): string {
  return new Date(iso).toLocaleString("en-ZA", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(full
      ? {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23" as const,
        }
      : {}),
  });
}
export function auditTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
