import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, HeartPulse, LockKeyhole, Mail, UserRound } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import { confirmPatientPasswordReset, requestPatientPasswordReset } from "@/shared/api/patientAuth";
import "./patient-login.css";

export function PatientForgotPasswordScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [complete, setComplete] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: requestPatientPasswordReset,
    onSuccess: () => {
      setRequested(true);
      setResendIn(60);
      setFormError(null);
    },
    onError: () => setFormError("We couldn't request a reset code. Please try again."),
  });
  const resendMutation = useMutation({
    mutationFn: requestPatientPasswordReset,
    onSuccess: () => setResendIn(60),
    onError: () => setFormError("We couldn't resend a reset code. Please try again."),
  });
  const confirmMutation = useMutation({
    mutationFn: confirmPatientPasswordReset,
    onSuccess: () => {
      setComplete(true);
      setFormError(null);
    },
    onError: (error) => setFormError(error instanceof ApiError && error.status === 400
      ? error.message
      : "We couldn't reset your password. Please try again."),
  });

  useEffect(() => {
    if (resendIn <= 0) return;
    const timeout = window.setTimeout(() => setResendIn((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timeout);
  }, [resendIn]);

  if (!tenantSlug) return <Navigate to="/login" replace />;
  const base = `/org/${encodeURIComponent(tenantSlug)}`;
  const busy = requestMutation.isPending || resendMutation.isPending || confirmMutation.isPending;

  const requestCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = identifier.trim();
    if (!normalized) {
      setFormError("Enter your email address or South African ID number.");
      return;
    }
    setFormError(null);
    setIdentifier(normalized);
    requestMutation.mutate({ identifier: normalized, tenantSlug });
  };

  const resetPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (!/^\d{6}$/.test(code.trim())) return setFormError("Enter the six-digit code from your email.");
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return setFormError("Use at least 8 characters, including a letter and a number.");
    }
    if (newPassword !== confirmPassword) return setFormError("The passwords do not match.");
    confirmMutation.mutate({ identifier, code: code.trim(), newPassword, tenantSlug });
  };

  return <div className="patient-login">
    <aside className="pl-story" aria-label="Patient portal password help">
      <img className="pl-photo" src="/login-background.jpg" alt="A healthcare professional with a patient" />
      <div className="pl-photo-shade" />
      <Link className="pl-brand" to={base}><span><HeartPulse size={25} aria-hidden /></span><div>Patient portal<small>POWERED BY ULWEMBU EHEALTH</small></div></Link>
      <div className="pl-story-copy"><p className="pl-eyebrow">SECURE ACCESS TO YOUR CARE</p><h1>A fresh start.<br /><em>Your care, connected.</em></h1><p>Reset your password securely and return to your patient portal.</p></div>
    </aside>
    <main className="pl-main">
      <Link to={`${base}/patient/login`} className="pl-back"><ArrowLeft size={16} aria-hidden />Back to sign in</Link>
      <div className="pl-form-wrap">
        <span className="pl-welcome-icon"><LockKeyhole size={25} aria-hidden /></span>
        <p className="pl-eyebrow">YOUR PATIENT PORTAL</p>
        {complete ? <>
          <h2>Password updated<span>.</span></h2>
          <p className="pl-subtitle">Your password has been reset. Sign in with your new password.</p>
          <button type="button" className="pl-submit" onClick={() => navigate(`${base}/patient/login`)}>Back to sign in <ArrowRight size={18} aria-hidden /></button>
        </> : requested ? <>
          <h2>Check your email<span>.</span></h2>
          <p className="pl-subtitle">If an account matches, a six-digit reset code was sent to its registered email address. The code expires in 10 minutes.</p>
          <form className="pl-form" onSubmit={resetPassword} noValidate>
            {formError && <div role="alert" className="pl-error-banner">{formError}</div>}
            <fieldset disabled={busy}>
              <div className="pl-field"><label htmlFor="patient-reset-identifier">Email or South African ID number</label><div className="pl-input-wrap"><UserRound size={19} aria-hidden /><input id="patient-reset-identifier" value={identifier} readOnly /></div></div>
              <div className="pl-field"><label htmlFor="patient-reset-code">Six-digit email code</label><div className="pl-input-wrap"><Mail size={19} aria-hidden /><input id="patient-reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></div></div>
              <div className="pl-field"><label htmlFor="patient-new-password">New password</label><div className="pl-input-wrap"><LockKeyhole size={19} aria-hidden /><input id="patient-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div></div>
              <div className="pl-field"><label htmlFor="patient-confirm-password">Confirm new password</label><div className="pl-input-wrap"><LockKeyhole size={19} aria-hidden /><input id="patient-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div></div>
            </fieldset>
            <button type="submit" className="pl-submit" disabled={busy}>{confirmMutation.isPending ? "Updating password…" : "Reset password"} {!busy && <ArrowRight size={18} aria-hidden />}</button>
          </form>
          <p className="pl-help"><button type="button" disabled={resendIn > 0 || busy} onClick={() => { setFormError(null); resendMutation.mutate({ identifier, tenantSlug }); }}>{resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}</button></p>
          <div className="pl-register"><button type="button" onClick={() => { setRequested(false); setFormError(null); }}>Use a different email or ID</button></div>
        </> : <>
          <h2>Reset password<span>.</span></h2>
          <p className="pl-subtitle">Enter the email address or South African ID number on your patient account. We’ll send a reset code to its registered email.</p>
          <form className="pl-form" onSubmit={requestCode} noValidate>
            {formError && <div role="alert" className="pl-error-banner">{formError}</div>}
            <fieldset disabled={busy}>
              <div className="pl-field"><label htmlFor="patient-reset-request-identifier">Email or South African ID number</label><div className="pl-input-wrap"><UserRound size={19} aria-hidden /><input id="patient-reset-request-identifier" autoComplete="username" autoCapitalize="none" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="you@example.com or 13-digit ID" /></div></div>
            </fieldset>
            <button type="submit" className="pl-submit" disabled={busy}>{requestMutation.isPending ? "Sending code…" : "Send reset code"} {!busy && <ArrowRight size={18} aria-hidden />}</button>
          </form>
        </>}
        <div className="pl-register"><span>Remembered your password?</span><Link to={`${base}/patient/login`}>Sign in <ArrowRight size={16} aria-hidden /></Link></div>
      </div>
      <footer className="pl-footer"><span>© {new Date().getFullYear()}</span><span>Ulwembu eHealth</span></footer>
    </main>
  </div>;
}
