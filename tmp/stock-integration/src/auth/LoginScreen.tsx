import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { StaffLoginLayout } from "./StaffLoginLayout";
import { loginSchema, type LoginValues } from "./validation";
import { login } from "@/shared/api/auth";
import { getPublicOrganization } from "@/shared/api/publicOrganization";
import { ApiError, apiOrigin } from "@/shared/api/client";
import { useAuth } from "./AuthContext";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";

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
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    onSuccess: (user) => {
      setUser(user);
      navigate("/app", { replace: true });
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
  if (!tenantSlug) return <Navigate to="/login" replace />;

  return (
    <StaffLoginLayout key={tenantSlug} tenantSlug={tenantSlug}>
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
