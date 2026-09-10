import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { loginSchema, type LoginValues } from "./validation";
import { getTenantAuthPolicy, login, startSso, SsoUnavailableError } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import { useAuth } from "./AuthContext";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Button } from "@/shared/components/Button";

// Reached at /org/:tenantSlug/login — the slug comes from the route, not a
// typed form field (see validation.ts's own why-note on loginSchema). A
// bare /login with no slug never renders this: FindOrganizationScreen owns
// that path and is the only thing that ever navigates here.
export function LoginScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const policyQuery = useQuery({
    queryKey: ["tenant-auth-policy", tenantSlug],
    queryFn: () => getTenantAuthPolicy(tenantSlug!),
    enabled: Boolean(tenantSlug),
  });

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
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: LoginValues) => {
    if (!tenantSlug) return;
    setFormError(null);
    mutation.mutate({ ...values, tenantSlug });
  };

  const handleSso = async () => {
    if (!tenantSlug) return;
    setSsoError(null);

    if (policyQuery.data && !policyQuery.data.ssoEnabled) {
      setSsoError("Your organisation has not enabled employer sign-in yet. Please use your email and password instead.");
      return;
    }

    try {
      const { authorizationUrl } = await startSso(tenantSlug);
      window.location.assign(authorizationUrl);
    } catch (error) {
      setSsoError(
        error instanceof ApiError
          ? error.message
          : error instanceof SsoUnavailableError
            ? error.message
            : "Single sign-on is unavailable for this organisation.",
      );
    }
  };

  // No slug in the URL at all (shouldn't normally happen — the route
  // requires it — but a malformed/hand-typed URL like /org//login could
  // still reach here with an empty param) sends the visitor to the gate
  // that actually collects one, rather than submitting a login with no
  // X-Tenant-ID and letting the backend's 404 be the first sign anything's
  // wrong.
  if (!tenantSlug) return <Navigate to="/login" replace />;

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Enter your email and password to continue."
      footer="Need a staff account? Contact your facility administrator."
      tenantSlug={tenantSlug}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="auth-fields flex flex-col gap-4">
        {(formError || ssoError) && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600"
          >
            {formError ?? ssoError}
          </div>
        )}

        <Button type="button" size="lg" variant="secondary" icon={<ShieldCheck className="size-4" aria-hidden />} onClick={handleSso}>
          Sign in with your employer
        </Button>

        {(policyQuery.data?.ssoEnabled ?? false) && policyQuery.data?.passwordLoginEnabled && (
          <div className="flex items-center gap-3 text-[12px] text-text-secondary before:h-px before:flex-1 before:bg-border-subtle after:h-px after:flex-1 after:bg-border-subtle">
            Or use your password
          </div>
        )}

        {(!policyQuery.data || policyQuery.data.passwordLoginEnabled) && <Input
          label="Email"
          required
          type="email"
          icon={<Mail className="size-4" aria-hidden />}
          placeholder="you@clinic.org"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />}

        {(!policyQuery.data || policyQuery.data.passwordLoginEnabled) && <div>
          <PasswordInput
            label="Password"
            required
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <div className="mt-2 text-right">
            <Link
              to={`/org/${tenantSlug}/forgot-password`}
              className="text-[13px] font-medium text-brand-600 hover:text-brand-700"
            >
              Forgot password?
            </Link>
          </div>
        </div>}

        {(!policyQuery.data || policyQuery.data.passwordLoginEnabled) ? (
          <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
            Sign in
          </Button>
        ) : (
          <p className="text-center text-[13.5px] text-text-secondary">
            Password sign-in is disabled for this organisation.
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
