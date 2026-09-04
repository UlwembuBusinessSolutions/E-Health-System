import { z } from "zod";

const EMPLOYMENT_TYPE_OPTIONS = [
  "PERMANENT",
  "CONTRACT",
  "INTERN",
  "COMMUNITY_SERVICE",
  "EXTENDED_PUBLIC_WORKS",
  "SECONDED",
] as const;

// Mirrors StaffController.CreateStaffRequest field-for-field
// (api-reference.html, Staff admin module) — idNumber, employmentStartDate,
// employmentType, and the three registration expiry dates are optional
// there too. idNumber uses South Africa's 13-digit ID number format when
// present; emergencyContactPhone reuses the same phone pattern as
// contactNumber.
export const createStaffSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(60),
    lastName: z.string().trim().min(1, "Last name is required").max(60),
    employeeNumber: z.string().trim().min(1, "Employee number is required").max(30),
    idNumber: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[0-9]{13}$/.test(value), "Enter a valid 13-digit SA ID number"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    contactNumber: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number, e.g. +27821234567"),
    gender: z.string().min(1, "Select a gender"),
    dateOfBirth: z.string().trim().max(10),
    employmentStartDate: z.string().trim().max(10),
    employmentType: z.union([z.enum(EMPLOYMENT_TYPE_OPTIONS), z.literal("")]),
    facilityId: z.string().min(1, "Select a clinic"),
    department: z.string().trim().max(100),
    designation: z.string().trim().max(100),
    roleId: z.string().min(1, "Select a role"),
    sancNumber: z.string().trim().max(30),
    sancExpiryDate: z.string().trim().max(10),
    hpcsaNumber: z.string().trim().max(30),
    hpcsaExpiryDate: z.string().trim().max(10),
    sapcNumber: z.string().trim().max(30),
    sapcExpiryDate: z.string().trim().max(10),
    emergencyContactName: z.string().trim().max(120),
    emergencyContactRelationship: z.string().trim().max(60),
    emergencyContactPhone: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\+?[0-9]{9,15}$/.test(value), "Enter a valid contact number"),
  });

export type CreateStaffValues = z.infer<typeof createStaffSchema>;
