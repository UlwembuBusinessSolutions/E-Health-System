import { useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Hash, Mail, MailCheck, MapPin, Phone, User } from "lucide-react";
import { AuthLayout } from "@/auth/AuthLayout";
import { registerPatientAccount, verifyPatientRegistrationEmail } from "@/shared/api/patientAuth";
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
    idNumber: z.string().trim().refine(isValidSouthAfricanId, "Enter a valid 13-digit SA ID with a real birth date and checksum"),
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
function isValidSouthAfricanId(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false;

  const digits = value.split("").map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8] + digits[10];
  const evenNumber = Number(value.slice(1, 12).split("").filter((_, index) => index % 2 === 0).join(""));
  const doubledSum = String(evenNumber * 2).split("").reduce((sum, digit) => sum + Number(digit), 0);
  const date = value.slice(0, 6);
  const month = Number(date.slice(2, 4));
  const day = Number(date.slice(4, 6));
  const currentYear = new Date().getFullYear() % 100;
  const year = Number(date.slice(0, 2));
  const fullYear = (year <= currentYear ? 2000 : 1900) + year;
  const birthDate = new Date(fullYear, month - 1, day);

  return (oddSum + doubledSum + digits[12]) % 10 === 0
    && month >= 1 && month <= 12
    && birthDate.getFullYear() === fullYear
    && birthDate.getMonth() === month - 1
    && birthDate.getDate() === day;
}
type RegisterValues = z.infer<typeof registerSchema>;

const PATIENT_SETUP_STEPS = ["Your details", "Verify email", "Book care"];

function PatientSetupSteps({ currentStep }: { currentStep: number }) {
  return (
    <ol aria-label="Patient account progress" className="mb-5 grid grid-cols-3 gap-2">
      {PATIENT_SETUP_STEPS.map((label, index) => {
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;
        return (
          <li key={label} className="flex min-w-0 flex-col gap-2">
            <span className={`h-1.5 rounded-full ${isComplete || isCurrent ? "bg-brand-500" : "bg-slate-200"}`} />
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={`truncate text-center text-[10px] font-semibold uppercase tracking-[.12em] ${
                isCurrent ? "text-brand-700" : isComplete ? "text-brand-600" : "text-slate-400"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

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
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [verificationExpiresInMinutes, setVerificationExpiresInMinutes] = useState(10);
  const [verificationCode, setVerificationCode] = useState("");
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
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
    onSuccess: (result) => {
      if (!result?.verificationRequired || !result.email) {
        setFormError("The server did not start email verification. Reload the registration page and try again.");
        return;
      }
      setVerificationEmail(result.email);
      setVerificationExpiresInMinutes(result.expiresInMinutes);
      setResendNotice(null);
      setFormError(null);
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const resendMutation = useMutation({
    mutationFn: registerPatientAccount,
    onSuccess: (result) => {
      if (!result?.verificationRequired || !result.email) {
        setFormError("The server did not resend the verification code. Please try again.");
        return;
      }
      setVerificationEmail(result.email);
      setVerificationExpiresInMinutes(result.expiresInMinutes);
      setVerificationCode("");
      setResendNotice(`A new code was sent to ${result.email}. Use the newest code.`);
      setFormError(null);
    },
    onError: (error) => {
      setResendNotice(null);
      setFormError(error instanceof ApiError ? error.message : "We couldn't resend the code. Please try again.");
    },
  });

  const verificationMutation = useMutation({
    mutationFn: verifyPatientRegistrationEmail,
    onSuccess: (account) => {
      setAccount(account);
      navigate(`/org/${tenantSlug}/patient/book`, { replace: true });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "That code could not be verified. Please try again.");
    },
  });

  const onSubmit = (values: RegisterValues) => {
    if (!tenantSlug) return;
    setFormError(null);
    mutation.mutate({ ...values, tenantSlug });
  };

  const onVerify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verificationEmail) return;
    setFormError(null);
    verificationMutation.mutate({ email: verificationEmail, code: verificationCode.trim() });
  };

  const onResendCode = () => {
    if (!tenantSlug) return;
    const values = registerSchema.safeParse(getValues());
    if (!values.success) {
      setFormError("Your registration details are no longer available. Start account creation again to request a code.");
      return;
    }
    const { firstName, lastName, idNumber, address, contactNumber, email, password } = values.data;
    setFormError(null);
    setResendNotice(null);
    resendMutation.mutate({ tenantSlug, firstName, lastName, idNumber, address, contactNumber, email, password });
  };

  if (!tenantSlug) return <Navigate to="/login" replace />;

  return (
    <AuthLayout
      title={verificationEmail ? "Verify your email" : "Create your account"}
      subtitle={verificationEmail
        ? "Confirm your email to protect your patient account."
        : "Register to manage your care online. We’ll verify your email before creating your patient record."}
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
      <PatientSetupSteps currentStep={verificationEmail ? 1 : 0} />
      {verificationEmail && (
        <div className="mb-5 flex gap-3 rounded-xl border border-brand-500/20 bg-brand-50/70 p-4 shadow-sm">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Check your inbox</p>
            <p className="mt-1 break-words text-xs leading-relaxed text-slate-600">
              We sent a six-digit code to <strong className="font-semibold text-slate-800">{verificationEmail}</strong>.
              It expires in {verificationExpiresInMinutes} minutes. Check Spam or Junk if it isn’t there.
            </p>
          </div>
        </div>
      )}
      {verificationEmail ? (
        <form onSubmit={onVerify} noValidate className="auth-fields flex flex-col gap-4">
          {formError && <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">{formError}</div>}
          {resendNotice && <div role="status" className="rounded-lg border border-brand-500/30 bg-brand-50 px-3.5 py-2.5 text-[13.5px] text-brand-700">{resendNotice}</div>}
          <Input
            label="Email verification code"
            required
            icon={<Mail className="size-4" aria-hidden />}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="6-digit code"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
          <Button type="submit" size="lg" loading={verificationMutation.isPending} disabled={verificationCode.length !== 6} className="mt-1 w-full">
            Verify email and create account
          </Button>
          <button type="button" className="text-sm font-medium text-brand-600 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={onResendCode} disabled={resendMutation.isPending}>
            {resendMutation.isPending ? "Sending a new code…" : "Resend code"}
          </button>
          <button type="button" className="text-sm text-slate-600 hover:text-slate-800" onClick={() => { setVerificationEmail(null); setVerificationCode(""); setResendNotice(null); setFormError(null); }}>
            Change registration details
          </button>
        </form>
      ) : <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields flex flex-col gap-4">
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
      </form>}
    </AuthLayout>
  );
}
