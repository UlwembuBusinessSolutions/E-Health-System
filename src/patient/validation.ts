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
  medicalAidProvider: z.string().trim().max(100),
  medicalAidNumber: z.string().trim().max(50),
  nextOfKin: z.array(z.object({
    name: z.string().trim().min(1, "Name is required").max(200),
    relationship: z.string().trim().min(1, "Relationship is required").max(100),
    contactNumber: z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number"),
  })).min(1, "Add at least one next-of-kin or guardian"),
});

export type RegisterPatientValues = z.infer<typeof registerPatientSchema>;
