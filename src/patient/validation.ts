import { z } from "zod";

export function extractSouthAfricanIdDateOfBirth(idNumber: string): string | null {
  if (!/^\d{13}$/.test(idNumber)) return null;

  const yearPart = Number(idNumber.slice(0, 2));
  const month = Number(idNumber.slice(2, 4));
  const day = Number(idNumber.slice(4, 6));
  const currentYear = new Date().getFullYear() % 100;
  const year = (yearPart <= currentYear ? 2000 : 1900) + yearPart;
  const birthDate = new Date(year, month - 1, day);

  if (
    month < 1 ||
    month > 12 ||
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Mirrors PatientController.RegisterPatientRequest field-for-field. The ID
// shape and encoded calendar date are checked here; the server remains
// responsible for its full validation, including the check digit.
export const registerPatientSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    idNumber: z.string().trim().regex(/^[0-9]{13}$/, "Enter a valid 13-digit SA ID number"),
    dateOfBirth: z.string().trim().min(1, "Date of birth is required"),
    parentRelationship: z.enum(["MOTHER", "FATHER"]).optional().or(z.literal("")),
    patientFileNumber: z.string().trim().max(100),
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
  })
  .superRefine((values, context) => {
    if (!/^\d{13}$/.test(values.idNumber)) return;

    const idDateOfBirth = extractSouthAfricanIdDateOfBirth(values.idNumber);
    if (!idDateOfBirth) {
      context.addIssue({
        code: "custom",
        path: ["idNumber"],
        message: "The ID number contains an invalid date of birth",
      });
    } else if (values.dateOfBirth && values.dateOfBirth !== idDateOfBirth) {
      context.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Date of birth must match the date encoded in the SA ID number",
      });
    }
  });

export type RegisterPatientValues = z.infer<typeof registerPatientSchema>;
