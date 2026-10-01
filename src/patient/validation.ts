import { z } from "zod";

// Mirrors PatientController.RegisterPatientRequest field-for-field. Only
// format is checked client-side (13 digits) — the real check-digit/date
// validation (SouthAfricanIdNumber.parse()) is server-side, same "client
// checks shape, server checks the actual business rule" split
// staff/validation.ts's own idNumber field already uses.
export const registerPatientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  idNumber: z.string().trim().regex(/^[0-9]{13}$/, "Enter a valid 13-digit SA ID number"),
  address: z.string().trim().min(1, "Address is required").max(500),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number, e.g. +27821234567"),
  // Optional — cross-tenant patient migration's own notification email is
  // the first thing that actually reads this; an empty string is valid
  // (RegisterPatientPayload's own optional field), a non-empty one must
  // still look like an email.
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  medicalAidProvider: z.string().trim().max(100),
  medicalAidNumber: z.string().trim().max(50),
  // Supplementary to idNumber above, not an alternative to it — see
  // PatientController.RegisterPatientRequest's own why-note. No format
  // check beyond length: passport number formats vary too widely across
  // issuing countries for one regex the way idNumber's SA-specific pattern
  // works.
  passportNumber: z.string().trim().max(20),
  passportExpiry: z.string().trim(),
});

export type RegisterPatientValues = z.infer<typeof registerPatientSchema>;
