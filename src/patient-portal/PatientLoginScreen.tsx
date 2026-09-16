import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Mail, LockKeyhole, Eye, EyeOff, ArrowRight, ArrowLeft, HeartPulse } from "lucide-react";
import { getPublicOrganization } from "@/shared/api/publicOrganization";
import "./patient-login.css";
import { patientLogin } from "@/shared/api/patientAuth";
import { ApiError } from "@/shared/api/client";
import { usePatientAuth } from "./PatientAuthContext";
import { Button } from "@/shared/components/Button";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type LoginValues = z.infer<typeof loginSchema>;

// Reached at /org/:tenantSlug/patient/login — same shape as auth/LoginScreen
// (the staff equivalent), reusing the same AuthLayout for visual
// consistency, but signs into the patient portal's own identity
// (PatientAuthContext) rather than the staff one.
export function PatientLoginScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const orgQuery = useQuery({ queryKey: ["public-organization", tenantSlug], queryFn: () => getPublicOrganization(tenantSlug ?? ""), enabled: !!tenantSlug, retry: false });
  const { setAccount } = usePatientAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: patientLogin,
    onSuccess: (account) => {
      setAccount(account);
      navigate(`/org/${tenantSlug}/patient/portal`, { replace: true });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: LoginValues) => {
    if (!tenantSlug) return;
    setFormError(null);
    mutation.mutate({ ...values, tenantSlug });
  };

  if (!tenantSlug) return <Navigate to="/login" replace />;

  const base = `/org/${encodeURIComponent(tenantSlug)}`;
  const orgName = orgQuery.data?.displayName ?? "Patient portal";
  const busy = isSubmitting || mutation.isPending;
  return <div className="patient-login">
    <aside className="pl-story" aria-label="Welcome to your patient portal">
      <img className="pl-photo" src="/login-background.jpg" alt="A healthcare professional with a patient" />
      <div className="pl-photo-shade" />
      <Link className="pl-brand" to={base}><span><HeartPulse size={25} aria-hidden /></span><div>{orgName}<small>POWERED BY ULWEMBU EHEALTH</small></div></Link>
      <div className="pl-story-copy"><p className="pl-eyebrow">A LITTLE CLOSER TO YOUR CARE</p><h1>Your journey.<br /><em>Your space.</em></h1><p>A familiar place to connect with {orgName}. Your next step starts here.</p><div className="pl-story-note"><HeartPulse size={21} aria-hidden /><span>People at the heart of care.</span></div></div>
    </aside>
    <main className="pl-main">
      <Link to={base} className="pl-back"><ArrowLeft size={16} aria-hidden />Back to {orgQuery.data ? orgName : "home"}</Link>
      <div className="pl-form-wrap">
        <span className="pl-welcome-icon"><UserIcon /></span>
        <p className="pl-eyebrow">YOUR PATIENT PORTAL</p>
        <h2>Welcome back<span>.</span></h2>
        <p className="pl-subtitle">A moment to sign in. A step closer to your care.</p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="pl-form" aria-label="Patient sign in">
          {formError && <div role="alert" className="pl-error-banner">{formError}</div>}
          <fieldset disabled={busy}>
            <div className="pl-field">
              <label htmlFor="patient-email">Email address</label>
              <div className={`pl-input-wrap ${errors.email ? "pl-invalid" : ""}`}><Mail size={19} aria-hidden /><input id="patient-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" aria-required="true" aria-invalid={!!errors.email} aria-describedby={errors.email ? "patient-email-error" : undefined} {...register("email")} /></div>
              {errors.email && <p role="alert" id="patient-email-error" className="pl-field-error">{errors.email.message}</p>}
            </div>
            <div className="pl-field">
              <label htmlFor="patient-password">Password</label>
              <div className={`pl-input-wrap ${errors.password ? "pl-invalid" : ""}`}><LockKeyhole size={19} aria-hidden /><input id="patient-password" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" aria-required="true" aria-invalid={!!errors.password} aria-describedby={errors.password ? "patient-password-error" : undefined} {...register("password")} /><button type="button" className="pl-password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} aria-controls="patient-password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}</button></div>
              {errors.password && <p role="alert" id="patient-password-error" className="pl-field-error">{errors.password.message}</p>}
            </div>
          </fieldset>
          <Button type="submit" size="lg" loading={busy} className="pl-submit" icon={!busy ? <ArrowRight size={18} aria-hidden /> : undefined}>{busy ? "Signing in..." : "Sign in to your portal"}</Button>
        </form>
        <p className="pl-help">Need help signing in? {orgQuery.data?.contactEmail ? <a href={`mailto:${orgQuery.data.contactEmail}`}>Contact your clinic</a> : <Link to={`${base}#contact`}>Contact your clinic</Link>}</p>
        <div className="pl-register"><span>New to the patient portal?</span><Link to={`${base}/patient/register`}>Create an account <ArrowRight size={16} aria-hidden /></Link></div>
        <div className="pl-staff"><span>Here as a staff member?</span> <Link to={`${base}/login`}>Staff sign in</Link></div>
      </div>
      <footer className="pl-footer"><span>&copy; {new Date().getFullYear()} {orgName}</span><span>Ulwembu eHealth</span></footer>
    </main>
  </div>;
}

function UserIcon() { return <LockKeyhole size={25} aria-hidden />; }
