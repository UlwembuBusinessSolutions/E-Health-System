import { z } from "zod";

const southAfricanIdSchema = z
  .string()
  .regex(
    /^[0-9]{13}$/,
    "Enter a valid 13-digit SA ID number",
  );

const passportSchema = z
  .string()
  .regex(
    /^[A-Za-z0-9]{6,15}$/,
    "Enter a valid passport number",
  );

const identityNumberSchema = z
  .string()
  .trim()
  .min(
    1,
    "ID number or passport number is required",
  )
  .refine(
    (value) => {
      if (/^[0-9]+$/.test(value)) {
        return southAfricanIdSchema.safeParse(value).success;
      }
      return passportSchema.safeParse(value).success;
    },
    {
      message:
        "Enter a valid SA ID number or passport number",
    },
  );

export const registerPatientSchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name is required")
      .max(100),

    lastName: z
      .string()
      .trim()
      .min(1, "Last name is required")
      .max(100),

    idNumber: identityNumberSchema,

    dateOfBirth: z
      .string()
      .optional(),

    gender: z
      .string()
      .optional(),

    citizenshipStatus: z
      .string()
      .optional(),

    address: z
      .string()
      .trim()
      .min(1, "Address is required")
      .max(500),

    contactNumber: z
      .string()
      .trim()
      .regex(
        /^\+?[0-9]{9,15}$/,
        "Enter a valid contact number, e.g. +27821234567",
      ),

    medicalAidProvider: z
      .string()
      .trim()
      .max(100),

    medicalAidNumber: z
      .string()
      .trim()
      .max(50),
  })

  .superRefine((data, ctx) => {
    const isPassport = /[A-Za-z]/.test(
      data.idNumber,
    );

    if (!isPassport) {
      return;
    }

    if (!data.dateOfBirth?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateOfBirth"],
        message:
          "Date of birth is required for passport registration",
      });
    }

    if (!data.gender?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gender"],
        message:
          "Gender is required for passport registration",
      });
    }

    if (!data.citizenshipStatus?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["citizenshipStatus"],
        message:
          "Citizenship status is required for passport registration",
      });
    }
  });

export type RegisterPatientValues =
  z.infer<typeof registerPatientSchema>;

  
export const editPatientSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),

    idNumber: identityNumberSchema,

    dateOfBirth: z.string().optional(),
    gender: z.string().optional(),
    citizenshipStatus: z.string().optional(),

    address: z.string().trim().min(1, "Address is required").max(500),
    contactNumber: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number, e.g. +27821234567"),

    medicalAidProvider: z.string().trim().max(100),
    medicalAidNumber: z.string().trim().max(50),

    reasonForChange: z.string().trim().max(500),
  })
  .superRefine((data, ctx) => {
    const isPassport = /[A-Za-z]/.test(data.idNumber);
    if (!isPassport) return;

    if (!data.dateOfBirth?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dateOfBirth"], message: "Date of birth is required" });
    }
    if (!data.gender?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gender"], message: "Gender is required" });
    }
    if (!data.citizenshipStatus?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["citizenshipStatus"],
        message: "Citizenship status is required",
      });
    }
  });

export type EditPatientValues = z.infer<typeof editPatientSchema>;

export const CLINICALLY_SIGNIFICANT_FIELDS = [
  "idNumber",
  "dateOfBirth",
  "gender",
  "citizenshipStatus",
] as const;