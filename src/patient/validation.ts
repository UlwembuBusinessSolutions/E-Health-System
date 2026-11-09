import { z } from "zod";

// Mirrors PatientController.RegisterPatientRequest field-for-field. When an
// SA ID is unavailable, reception captures DOB and gender directly.
export const registerPatientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  idNumber: z.string().trim(),
  dateOfBirth: z.string().trim(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", ""]).optional(),
  citizenshipStatus: z.enum(["SA_CITIZEN", "PERMANENT_RESIDENT", "UNKNOWN", ""]).optional(),
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
}).superRefine((value, ctx) => {
  if (value.idNumber && !/^[0-9]{13}$/.test(value.idNumber)) {
    ctx.addIssue({ code: "custom", path: ["idNumber"], message: "Enter a valid 13-digit SA ID number" });
  }
  if (!value.idNumber && !value.dateOfBirth) {
    ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth is required when no SA ID is available" });
  }
  if (!value.idNumber && !value.gender) {
    ctx.addIssue({ code: "custom", path: ["gender"], message: "Select a gender when no SA ID is available" });
  }
});

export type RegisterPatientValues = z.infer<typeof registerPatientSchema>;
