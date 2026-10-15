import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Mail } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import {
  forgotPasswordRequestSchema,
  resetPasswordSchema,
  type ForgotPasswordRequestValues,
  type ResetPasswordValues,
} from "./validation";
import { requestPasswordReset, resetPassword } from "@/shared/api/auth";
import { ApiError } from "@/shared/api/client";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";

type Step = "request" | "verify" | "success";

const STEP_COPY: Record<Step, { title: string; subtitle?: string }> = {
  request: {
    title: "Forgot password",
    subtitle: "Enter your email and we'll send you a reset code.",
  },
  verify: {
    title: "Enter reset code",
    subtitle: "If that account exists, we've sent a 6-digit code. Enter it below with your new password.",
  },
  success: {
    title: "Password reset",
  },
};

function FormAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600"
    >
      {message}
    </div>
  );
}

export function ForgotPasswordScreen() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const requestForm = useForm<ForgotPasswordRequestValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: "", newPassword: "", confirmPassword: "" },
  });

  const requestMutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => setStep("verify"),
    onError: () => setFormError("Something went wrong. Please try again."),
  });

  const resendMutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => showToast("Code resent.", "success"),
    onError: () => showToast("Couldn't resend the code. Try again.", "error"),
  });

  const resetMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => setStep("success"),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 400) {
        resetForm.setError("code", { type: "manual", message: error.message });
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    },
  });

  const onRequestSubmit = (values: ForgotPasswordRequestValues) => {
    if (!tenantSlug) return;
    setFormError(null);
    setEmail(values.email);
    requestMutation.mutate({ email: values.email, tenantSlug });
  };

  const onResetSubmit = (values: ResetPasswordValues) => {
    if (!tenantSlug) return;
    setFormError(null);
    resetMutation.mutate({ email, code: values.code, newPassword: values.newPassword, tenantSlug });
  };

  const { title, subtitle } = STEP_COPY[step];

  if (!tenantSlug) return <Navigate to="/login" replace />;

  return (
    <AuthLayout title={title} subtitle={subtitle} tenantSlug={tenantSlug}>
      <AnimatePresence mode="wait">
        {step === "request" && (
          <motion.form
            key="request"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onSubmit={requestForm.handleSubmit(onRequestSubmit)}
            noValidate
            className="auth-fields flex flex-col gap-4"
          >
            {formError && <FormAlert message={formError} />}
            <Input
              label="Email"
              required
              type="email"
              icon={<Mail className="size-4" aria-hidden />}
              placeholder="you@clinic.org"
              autoComplete="email"
              error={requestForm.formState.errors.email?.message}
              {...requestForm.register("email")}
            />
            <Button
              type="submit"
              size="lg"
              loading={requestForm.formState.isSubmitting || requestMutation.isPending}
              className="mt-1 w-full"
            >
              Send reset code
            </Button>
            <Button type="button" variant="secondary" size="lg" className="w-full" onClick={() => navigate(`/org/${tenantSlug}/login`)}>
              Back to sign in
            </Button>
          </motion.form>
        )}

        {step === "verify" && (
          <motion.form
            key="verify"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onSubmit={resetForm.handleSubmit(onResetSubmit)}
            noValidate
            className="auth-fields flex flex-col gap-4"
          >
            {formError && <FormAlert message={formError} />}
            <Input
              label="6-digit code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              error={resetForm.formState.errors.code?.message}
              {...resetForm.register("code")}
            />
            <PasswordInput
              label="New password"
              required
              autoComplete="new-password"
              hint={
                !resetForm.formState.errors.newPassword
                  ? "At least 8 characters, with a letter and a number."
                  : undefined
              }
              error={resetForm.formState.errors.newPassword?.message}
              {...resetForm.register("newPassword")}
            />
            <PasswordInput
              label="Confirm new password"
              required
              autoComplete="new-password"
              error={resetForm.formState.errors.confirmPassword?.message}
              {...resetForm.register("confirmPassword")}
            />
            <Button
              type="submit"
              size="lg"
              loading={resetForm.formState.isSubmitting || resetMutation.isPending}
              className="mt-1 w-full"
            >
              Reset password
            </Button>
            <div className="flex items-center justify-between text-[13px]">
              <button
                type="button"
                onClick={() => setStep("request")}
                className="font-medium text-text-secondary hover:text-text-primary"
              >
                Use a different account
              </button>
              <button
                type="button"
                disabled={resendMutation.isPending || !tenantSlug}
                onClick={() => tenantSlug && resendMutation.mutate({ email, tenantSlug })}
                className="font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </motion.form>
        )}

        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised px-6 py-8 text-center shadow-card"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <h3 className="text-[16px] font-semibold text-text-primary">Password updated</h3>
            <p className="text-[14px] text-text-secondary">
              Your password has been reset. Sign in with your new password.
            </p>
            <Button size="lg" className="mt-1 w-full" onClick={() => navigate(`/org/${tenantSlug}/login`)}>
              Back to sign in
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthLayout>
  );
}
