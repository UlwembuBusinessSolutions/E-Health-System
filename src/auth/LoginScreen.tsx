import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { StaffLoginLayout } from "./StaffLoginLayout";
import { loginSchema, type LoginValues } from "./validation";
import { login } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import { useAuth } from "./AuthContext";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";

export function LoginScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
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
    </StaffLoginLayout>
  );
}
