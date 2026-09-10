import { z } from "zod";

// Mirrors PlatformController.AdminRequest field-for-field — one admin's
// details, shared by provisioning and add-admins, same as the real backend
// shares AdminRequest between ProvisionOrganizationRequest and
// AddAdminsRequest.
export const adminInputSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  employeeNumber: z.string().trim().min(1, "Employee number is required").max(30),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number, e.g. +27821234567"),
  gender: z.string().min(1, "Select a gender"),
});

export type AdminInputValues = z.infer<typeof adminInputSchema>;

export const EMPTY_ADMIN: AdminInputValues = {
  firstName: "",
  lastName: "",
  employeeNumber: "",
  email: "",
  contactNumber: "",
  gender: "",
};

// Mirrors PlatformController.ProvisionOrganizationRequest field-for-field —
// admins takes one or more, same as the real @NotEmpty list. No password
// field anywhere — the backend generates each admin's temporary password
// itself and returns it once.
export const provisionOrganizationSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters")
    .max(63, "63 characters or fewer")
    .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Lowercase letters, digits and hyphens only, no leading/trailing hyphen"),
  displayName: z.string().trim().min(1, "Display name is required").max(200),
  // Loose string, not z.enum — same reasoning as adminInputSchema's own
  // gender field: an empty string is what the Select component's
  // placeholder state actually is before anything's chosen, and
  // ProvisionOrganizationScreen casts to OrganizationSector at submit time,
  // the same way it already does for gender.
  sector: z.string().min(1, "Select a sector"),
  admins: z.array(adminInputSchema).min(1, "Add at least one admin"),
});

export type ProvisionOrganizationValues = z.infer<typeof provisionOrganizationSchema>;

// Mirrors PlatformController.AddAdminsRequest — same admins list, targeting
// an organization that already exists rather than creating one.
export const addOrganizationAdminsSchema = z.object({
  admins: z.array(adminInputSchema).min(1, "Add at least one admin"),
});

export type AddOrganizationAdminsValues = z.infer<typeof addOrganizationAdminsSchema>;

// Mirrors PlatformAuthController.LoginRequest — deliberately as loose as
// auth/validation.ts's loginSchema (no password complexity rules here;
// those matter at creation time, not at login).
export const platformLoginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type PlatformLoginValues = z.infer<typeof platformLoginSchema>;

export const platformRegisterSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type PlatformRegisterValues = z.infer<typeof platformRegisterSchema>;

// Mirrors PlatformController.AddClinicRequest field-for-field (SADM-US-006).
// Only name/code/type are required — the backend's own address/phone/
// operatingHours fields are plain nullable strings, same optionality as
// FacilityController's existing tenant-side create form.
export const addClinicSchema = z.object({
  name: z.string().trim().min(1, "Clinic name is required").max(200),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Clinic code is required")
    .max(20, "20 characters or fewer")
    .regex(/^[A-Z0-9-]+$/, "Letters, digits and hyphens only"),
  type: z.string().min(1, "Select a type"),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  operatingHours: z.string().trim().max(200).optional().or(z.literal("")),
});

export type AddClinicValues = z.infer<typeof addClinicSchema>;

export const EMPTY_CLINIC: AddClinicValues = {
  name: "",
  code: "",
  type: "",
  address: "",
  phone: "",
  operatingHours: "",
};

// Mirrors PlatformOperatorController.CreateOperatorRequest field-for-field.
export const createOperatorSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

export type CreateOperatorValues = z.infer<typeof createOperatorSchema>;
