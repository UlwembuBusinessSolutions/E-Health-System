import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { resetPasswordSchema, type ResetPasswordValues } from "./validation";
import { resetPassword } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Button } from "@/shared/components/Button";

export function SetPasswordScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const email = searchParams.get("email") ?? "";
  const code = searchParams.get("code") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code, newPassword: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: (values: ResetPasswordValues) =>
      resetPassword({ email, code: values.code, newPassword: values.newPassword, tenantSlug: tenantSlug ?? "" }),
    onSuccess: () => setComplete(true),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 400) {
        form.setError("code", { type: "manual", message: error.message });
        return;
      }
      setFormError("This setup link is invalid or has expired. Request a new password reset code.");
    },
  });

  if (!tenantSlug) return <Navigate to="/login" replace />;

  return (
    <AuthLayout
      title={complete ? "Password set" : "Set your password"}
      subtitle={complete ? undefined : "Choose a password before signing in for the first time."}
      tenantSlug={tenantSlug}
    >
      {complete ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised px-6 py-8 text-center shadow-card">
          <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <p className="text-[14px] text-text-secondary">Your account is ready. Sign in with your new password.</p>
          <Button size="lg" className="mt-1 w-full" onClick={() => navigate(`/org/${tenantSlug}/login`)}>
            Continue to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit((values) => { setFormError(null); mutation.mutate(values); })} noValidate className="auth-fields flex flex-col gap-4">
          {formError && <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">{formError}</div>}
          {!email || !code ? (
            <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">This setup link is incomplete.</div>
          ) : null}
          <PasswordInput
            label="New password"
            required
            autoComplete="new-password"
            hint={!form.formState.errors.newPassword ? "At least 8 characters, with a letter and a number." : undefined}
            error={form.formState.errors.newPassword?.message}
            {...form.register("newPassword")}
          />
          <PasswordInput
            label="Confirm new password"
            required
            autoComplete="new-password"
            error={form.formState.errors.confirmPassword?.message}
            {...form.register("confirmPassword")}
          />
          <Button type="submit" size="lg" loading={form.formState.isSubmitting || mutation.isPending} disabled={!email || !code} className="mt-1 w-full">
            Set password
          </Button>
          <p className="text-center text-[12.5px] text-text-secondary">Setting a new password invalidates this setup link.</p>
        </form>
      )}
    </AuthLayout>
  );
}
