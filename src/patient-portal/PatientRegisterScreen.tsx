import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Hash, Mail, MapPin, Phone, User } from "lucide-react";
import { AuthLayout } from "@/auth/AuthLayout";
import { registerPatientAccount } from "@/shared/api/patientAuth";
import { ApiError } from "@/shared/api/client";
import { usePatientAuth } from "./PatientAuthContext";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Button } from "@/shared/components/Button";
import { FormRow } from "@/shared/components/FormRow";
import "@/auth/auth-fields.css";

// Mirrors PatientAuthController.RegisterRequest's own validation exactly
// (13-digit SA ID, 9-15 digit phone, 8+ char password) so a form error
// surfaces before the request round-trips at all.
const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(100),
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    idNumber: z.string().trim().regex(/^\d{13}$/, "Enter a valid 13-digit SA ID number"),
    address: z.string().trim().min(1, "Address is required").max(300),
    contactNumber: z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number, e.g. +27821234567"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
type RegisterValues = z.infer<typeof registerSchema>;

// Reached at /org/:tenantSlug/patient/register — a self-service signup, not
// a staff-created account (see PatientAuthService.register()'s own
// why-note on the ID-number reconciliation this triggers server-side: if
// reception already registered this person, the new account links to that
// existing clinical record instead of creating a duplicate; otherwise this
// call creates it).
export function PatientRegisterScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { setAccount } = usePatientAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      idNumber: "",
      address: "",
      contactNumber: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const mutation = useMutation({
    mutationFn: registerPatientAccount,
    onSuccess: (account) => {
      setAccount(account);
      navigate(`/org/${tenantSlug}/patient/portal`, { replace: true });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: RegisterValues) => {
    if (!tenantSlug) return;
    setFormError(null);
    mutation.mutate({ ...values, tenantSlug });
  };

  if (!tenantSlug) return <Navigate to="/login" replace />;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register to manage your care online."
      footer={
        <>
          Already have an account?{" "}
          <Link to={`/org/${tenantSlug}/patient/login`} className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
      tenantSlug={tenantSlug}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields flex flex-col gap-4">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600"
          >
            {formError}
          </div>
        )}

        <FormRow>
          <Input
            label="First name"
            required
            icon={<User className="size-4" aria-hidden />}
            autoComplete="given-name"
            error={errors.firstName?.message}
            {...register("firstName")}
          />
          <Input
            label="Last name"
            required
            autoComplete="family-name"
            error={errors.lastName?.message}
            {...register("lastName")}
          />
        </FormRow>

        <Input
          label="SA ID number"
          required
          icon={<Hash className="size-4" aria-hidden />}
          placeholder="13-digit ID number"
          hint="If you've already been seen at this clinic, this links your new account to your existing record."
          error={errors.idNumber?.message}
          {...register("idNumber")}
        />

        <Input
          label="Address"
          required
          icon={<MapPin className="size-4" aria-hidden />}
          error={errors.address?.message}
          {...register("address")}
        />

        <Input
          label="Contact number"
          required
          icon={<Phone className="size-4" aria-hidden />}
          placeholder="+27 82 123 4567"
          autoComplete="tel"
          error={errors.contactNumber?.message}
          {...register("contactNumber")}
        />

        <Input
          label="Email"
          required
          type="email"
          icon={<Mail className="size-4" aria-hidden />}
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <FormRow>
          <PasswordInput
            label="Password"
            required
            autoComplete="new-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <PasswordInput
            label="Confirm password"
            required
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register("confirmPassword")}
          />
        </FormRow>

        <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
