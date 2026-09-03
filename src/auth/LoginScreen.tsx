import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Mail } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { loginSchema, type LoginValues } from "./validation";
import { login } from "@/shared/api/auth";
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
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600"
          >
            {formError}
          </div>
        )}

        <Input
          label="Email"
          required
          type="email"
          icon={<Mail className="size-4" aria-hidden />}
          placeholder="you@clinic.org"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <div>
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
        </div>

        <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
