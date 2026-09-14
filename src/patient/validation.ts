import { z } from "zod";

const identityNumberSchema = z.string().trim().min(1, "ID number or passport number is required").refine(
  (value) => /^[0-9]{13}$/.test(value) || /^[A-Za-z0-9]{6,15}$/.test(value),
  "Enter a valid SA ID number or passport number",
);

const patientFields = {
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  idNumber: identityNumberSchema,
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  citizenshipStatus: z.string().optional(),
  address: z.string().trim().min(1, "Address is required").max(500),
  contactNumber: z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number, e.g. +27821234567"),
  medicalAidProvider: z.string().trim().max(100),
  medicalAidNumber: z.string().trim().max(50),
};

const requirePassportDetails = <T extends z.ZodObject<z.ZodRawShape>>(schema: T) => schema.superRefine((data, ctx) => {
  const patientData = data as Record<string, unknown>;
  if (!/[A-Za-z]/.test(String(patientData.idNumber))) return;
  for (const [field, message] of [["dateOfBirth", "Date of birth is required"], ["gender", "Gender is required"], ["citizenshipStatus", "Citizenship status is required"]] as const) {
    if (!String(patientData[field] ?? "").trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
  }
});

export const registerPatientSchema = requirePassportDetails(z.object(patientFields));
export type RegisterPatientValues = z.infer<typeof registerPatientSchema>;

export const editPatientSchema = requirePassportDetails(z.object({ ...patientFields, reasonForChange: z.string().trim().max(500) }));
export type EditPatientValues = z.infer<typeof editPatientSchema>;

export const CLINICALLY_SIGNIFICANT_FIELDS = ["idNumber", "dateOfBirth", "gender", "citizenshipStatus"] as const;
