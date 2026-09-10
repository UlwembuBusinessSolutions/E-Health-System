import { z } from "zod";

// tenantSlug is no longer part of this form — LoginScreen now reaches it as
// a route param (/org/:tenantSlug/login), not something typed at sign-in
// time. It still becomes the X-Tenant-ID header (shared/api/auth.ts),
// LoginScreen just attaches it to the mutation payload itself rather than
// this schema validating it.
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginValues = z.infer<typeof loginSchema>;

// The one place a slug is still hand-typed: FindOrganizationScreen, the
// gate a bare /login (or an unrecognised URL) lands on, which exists purely
// to redirect into /org/:tenantSlug/login. Same shape as
// ProvisionOrganizationScreen's own slug field on the platform side.
export const findOrganizationSchema = z.object({
  tenantSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Organization is required")
    .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, "Lowercase letters, digits and hyphens only"),
});

export type FindOrganizationValues = z.infer<typeof findOrganizationSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
});

export type ForgotPasswordRequestValues = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordSchema = z
  .object({
    code: z.string().trim().regex(/^[0-9]{6}$/, "Enter the 6-digit code"),
    newPassword: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
