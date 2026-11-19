import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Copy, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { StaffLoginLayout } from "./StaffLoginLayout";
import { loginSchema, type LoginValues } from "./validation";
import { establishMfaSession, login, type LoginResponse } from "@/shared/api/auth";
import {
  confirmMfaChallengeEnrolment,
  startMfaChallengeEnrolment,
  verifyMfaLogin,
  type MfaEnrolmentSecret,
} from "@/shared/api/mfa";
import { getPublicOrganization } from "@/shared/api/publicOrganization";
import { ApiError, apiOrigin } from "@/shared/api/client";
import { useAuth } from "./AuthContext";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { useOffline } from "@/offline/OfflineContext"; // OFFLINE
import type { AuthenticatedUser } from "@/shared/api/types";
import { AuthenticatorSetupHelpDialog } from "./AuthenticatorSetupHelpDialog";

// MicrosoftSsoService's own error codes, turned into something a person
// signing in can actually make sense of — every one of these is a query
// param on a redirect back from either SsoAuthController (the org exists
// but SSO isn't fully configured, or no staff account matches the signed-
// in Microsoft identity's email) or Microsoft's own consent screen itself
// (a person cancelling or denying consent lands here as
// "microsoft_access_denied").
const SSO_ERROR_MESSAGES: Record<string, string> = {
  org_not_found: "Couldn't find this organization. Check the link and try again.",
  not_configured: "Microsoft sign-in isn't fully set up for this organization yet.",
  no_account: "No staff account matches that Microsoft account's email address.",
  no_email: "Your Microsoft account has no email address this app can match to a staff account.",
  exchange_failed: "Microsoft sign-in didn't complete. Please try again.",
  microsoft_no_code: "Microsoft sign-in didn't complete. Please try again.",
  microsoft_access_denied: "Microsoft sign-in was cancelled.",
  missing_token: "Microsoft sign-in didn't complete. Please try again.",
  session_failed: "Signed in with Microsoft, but couldn't start your session. Please try again.",
};

export function LoginScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const offline = useOffline(); // OFFLINE
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingMfa, setPendingMfa] = useState<{
    challengeToken: string;
    challengeExpiresAt: string;
    enrolmentRequired: boolean;
    password: string;
  } | null>(null);
  const [completedMfa, setCompletedMfa] = useState<{
    response: LoginResponse;
    password: string;
    recoveryCodes: string[];
  } | null>(null);

  // Same queryKey StaffLoginLayout's own org query uses — TanStack Query
  // dedupes the two into one request, this component just also needs the
  // microsoftSsoEnabled field that layout never reads.
  const organizationQuery = useQuery({
    queryKey: ["public-organization", tenantSlug],
    queryFn: () => getPublicOrganization(tenantSlug ?? ""),
    enabled: !!tenantSlug,
    retry: false,
    staleTime: 60000,
  });

  // A completed (or abandoned) Microsoft sign-in lands back here with this
  // param — SSO_ERROR_MESSAGES' own why-note on where each code comes
  // from. Read once on mount, not on every render, so it doesn't
  // resurface after someone dismisses it by editing the form.
  useEffect(() => {
    const ssoError = searchParams.get("ssoError");
    if (ssoError) {
      setFormError(SSO_ERROR_MESSAGES[ssoError] ?? "Microsoft sign-in didn't complete. Please try again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: login,
    // OFFLINE: the password typed here is the only moment it is available,
    // so the encrypted offline vault is created/unlocked now, with no extra prompt.
    onSuccess: (result, variables) => {
      if (result.type === "mfa") {
        setPendingMfa({ ...result, password: variables.password });
        return;
      }
      finishSignIn(result.user, variables.password);
    },
    onError: (error) =>
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.",
      ),
  });
  const busy = isSubmitting || mutation.isPending;
  const onSubmit = (values: LoginValues) => {
    if (!tenantSlug || busy) return;
    setFormError(null);
    mutation.mutate({ ...values, tenantSlug });
  };
  function finishSignIn(user: AuthenticatedUser, password: string) {
    setUser(user);
    void offline.provisionAfterLogin(user.id, password);
    navigate("/app", { replace: true });
  }

  function completeMfa(response: LoginResponse) {
    if (!pendingMfa) return;
    const recoveryCodes = response.recoveryCodes ?? [];
    if (recoveryCodes.length) {
      setCompletedMfa({ response, password: pendingMfa.password, recoveryCodes });
      setPendingMfa(null);
      return;
    }
    const user = establishMfaSession(response);
    finishSignIn(user, pendingMfa.password);
    setPendingMfa(null);
  }

  if (!tenantSlug) return <Navigate to="/login" replace />;

  return (
    <StaffLoginLayout key={tenantSlug} tenantSlug={tenantSlug}>
      {completedMfa ? (
        <RecoveryCodesNotice
          codes={completedMfa.recoveryCodes}
          onContinue={() => finishSignIn(establishMfaSession(completedMfa.response), completedMfa.password)}
        />
      ) : pendingMfa ? (
        <MfaLoginStep
          challenge={pendingMfa}
          onComplete={completeMfa}
          onBack={() => {
            setPendingMfa(null);
            setFormError(null);
          }}
        />
      ) : (
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="sl-login-form"
        aria-label="Staff sign in"
        aria-busy={busy}
      >
        {formError && (
          <div role="alert" className="sl-form-error">
            {formError}
          </div>
        )}
        <Input
          label="Email address"
          required
          type="email"
          icon={<Mail size={16} aria-hidden />}
          placeholder="you@clinic.org"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          readOnly={busy}
          error={errors.email?.message}
          {...register("email")}
        />
        <div>
          <div className="sl-password-row">
            <Input
              label="Password"
              required
              type={showPassword ? "text" : "password"}
              icon={<LockKeyhole size={16} aria-hidden />}
              placeholder="Enter your password"
              autoComplete="current-password"
              readOnly={busy}
              error={errors.password?.message}
              {...register("password")}
            />
            <button
              type="button"
              className="sl-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? (
                <EyeOff size={16} aria-hidden />
              ) : (
                <Eye size={16} aria-hidden />
              )}
            </button>
          </div>
          <div className="sl-forgot">
            <Link to={`/org/${encodeURIComponent(tenantSlug)}/forgot-password`}>
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" size="lg" loading={busy} className="sl-submit">
          <span>{busy ? "Signing in…" : "Sign in to workspace"}</span>
          {!busy && <ArrowRight size={16} aria-hidden />}
        </Button>
      </form>
      )}
      {organizationQuery.data?.microsoftSsoEnabled && (
        <>
          <div className="sl-sso-divider">or</div>
          <a
            className="sl-sso-button"
            href={`${apiOrigin()}/api/v1/auth/sso/microsoft/start?tenantSlug=${encodeURIComponent(tenantSlug)}`}
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </a>
        </>
      )}
    </StaffLoginLayout>
  );
}

interface MfaChallengeState {
  challengeToken: string;
  challengeExpiresAt: string;
  enrolmentRequired: boolean;
}

function MfaLoginStep({
  challenge,
  onComplete,
  onBack,
}: {
  challenge: MfaChallengeState;
  onComplete: (response: LoginResponse) => void;
  onBack: () => void;
}) {
  const [secret, setSecret] = useState<MfaEnrolmentSecret | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthenticatorHelp, setShowAuthenticatorHelp] = useState(false);
  const setupMutation = useMutation({
    mutationFn: () => startMfaChallengeEnrolment(challenge.challengeToken),
    onSuccess: (result) => {
      setSecret(result);
      setShowAuthenticatorHelp(false);
      setError(null);
    },
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "Couldn't start MFA setup. Please try again."),
  });
  const verifyMutation = useMutation({
    mutationFn: () => challenge.enrolmentRequired
      ? confirmMfaChallengeEnrolment(challenge.challengeToken, code)
      : verifyMfaLogin(challenge.challengeToken, useRecoveryCode ? undefined : code, useRecoveryCode ? recoveryCode : undefined),
    onSuccess: onComplete,
    onError: (reason) => setError(reason instanceof ApiError ? reason.message : "MFA verification failed. Please try again."),
  });
  const busy = setupMutation.isPending || verifyMutation.isPending;
  const expiredAt = new Date(challenge.challengeExpiresAt);

  return (
    <div className="flex flex-col gap-5" aria-busy={busy}>
      <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
        <div>
          <h2 className="text-[16px] font-semibold text-text-primary">
            {challenge.enrolmentRequired ? "Set up two-step verification" : "Verify your identity"}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
            {challenge.enrolmentRequired
              ? "Your role requires MFA. Set up an authenticator app to continue."
              : "Enter the current 6-digit code from your authenticator app, or use a recovery code."}
          </p>
        </div>
      </div>
      {error && <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">{error}</div>}

      {challenge.enrolmentRequired && !secret ? (
        <Button type="button" size="lg" loading={setupMutation.isPending} onClick={() => setupMutation.mutate()}>
          Set up authenticator
        </Button>
      ) : challenge.enrolmentRequired && secret ? (
        <>
          <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
            <p className="text-[13px] font-semibold text-text-primary">Add this account to your authenticator</p>
            <p className="mt-1 text-[13px] text-text-secondary">In your app, choose to add an account manually and enter this setup key:</p>
            <code className="mt-3 block break-all rounded-lg bg-surface-sunken px-3 py-2.5 font-mono text-[13px] text-text-primary">{secret.secret}</code>
            <button
              type="button"
              className="mt-3 inline-block text-[13px] font-medium text-brand-600 underline"
              onClick={() => setShowAuthenticatorHelp(true)}
            >
              Open in an authenticator app
            </button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); setError(null); verifyMutation.mutate(); }} className="flex flex-col gap-4">
            <Input label="6-digit verification code" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} />
            <Button type="submit" size="lg" loading={verifyMutation.isPending} disabled={!/^\d{6}$/.test(code)}>Confirm and continue</Button>
          </form>
        </>
      ) : (
        <>
          {useRecoveryCode ? (
            <Input label="Recovery code" required autoComplete="one-time-code" value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} />
          ) : (
            <Input label="6-digit verification code" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} />
          )}
          <Button type="button" size="lg" loading={verifyMutation.isPending} disabled={useRecoveryCode ? !recoveryCode.trim() : !/^\d{6}$/.test(code)} onClick={() => { setError(null); verifyMutation.mutate(); }}>
            Verify and sign in
          </Button>
          <button type="button" className="self-start text-[13px] font-medium text-brand-600 underline" onClick={() => { setUseRecoveryCode((value) => !value); setError(null); }}>
            {useRecoveryCode ? "Use an authenticator code instead" : "Use a recovery code"}
          </button>
        </>
      )}
      {secret && showAuthenticatorHelp && (
        <AuthenticatorSetupHelpDialog
          setupKey={secret.secret}
          onClose={() => setShowAuthenticatorHelp(false)}
        />
      )}
      <p className="text-[12px] text-text-secondary">This sign-in challenge expires at {Number.isNaN(expiredAt.getTime()) ? "the displayed expiry" : expiredAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.</p>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 self-start text-[13px] font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft size={14} aria-hidden /> Back to sign in
      </button>
    </div>
  );
}

function RecoveryCodesNotice({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-success-500/30 bg-success-50 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success-600" aria-hidden />
        <div>
          <h2 className="text-[16px] font-semibold text-text-primary">Save your recovery codes</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">Each code works once if you lose access to your authenticator. These codes are shown only once.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-surface-raised p-4">
        {codes.map((code) => <code key={code} className="rounded-md bg-surface-sunken px-2 py-1.5 text-center font-mono text-[13px] text-text-primary">{code}</code>)}
      </div>
      <Button type="button" variant="secondary" onClick={() => void copyCodes()} icon={copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}>
        {copied ? "Recovery codes copied" : "Copy recovery codes"}
      </Button>
      <Button type="button" size="lg" onClick={onContinue}>I've saved my codes — continue</Button>
    </div>
  );
}

// The classic four-pane Microsoft mark — lucide-react (this app's one icon
// set everywhere else) has no brand icons, and a "Sign in with Microsoft"
// button without any Microsoft mark at all reads as unbranded/untrustworthy
// next to the real thing. Static, exact official colors — never themed.
function MicrosoftLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden focusable="false">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}