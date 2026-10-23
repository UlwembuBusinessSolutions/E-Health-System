import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Mail } from "lucide-react";
import { platformLoginSchema, type PlatformLoginValues } from "./validation";
import { loginPlatformOperator } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { usePlatformAuth } from "./PlatformAuthContext";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Button } from "@/shared/components/Button";

// This screen has Ulwembu's own identity, not a tenant's branding. Keep the
// platform-console copy while using the shared Ulwembu logo and login photo.
export function PlatformLoginScreen() {
  const navigate = useNavigate();
  const { setOperator } = usePlatformAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlatformLoginValues>({
    resolver: zodResolver(platformLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: loginPlatformOperator,
    onSuccess: (operator) => {
      setOperator(operator);
      navigate("/platform", { replace: true });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: PlatformLoginValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-900">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url(/login-background.jpg)" }}
        aria-hidden
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(4,30,58,.80) 0%, rgba(4,30,58,.58) 32%, rgba(4,30,58,.22) 56%, rgba(4,30,58,.14) 100%), linear-gradient(180deg, rgba(7,58,112,.16), rgba(7,58,112,.28))",
        }}
        aria-hidden
      />

      <div className="absolute left-8 top-8 z-10 hidden items-center gap-3 rounded-xl bg-white/95 px-3.5 py-2.5 shadow-lg lg:flex">
        <img src="/ulwembu-logo.png" alt="Ulwembu" className="h-9 w-auto object-contain" />
        <div className="leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700">Platform console</p>
        </div>
      </div>

      <div className="absolute bottom-14 left-8 z-10 hidden max-w-sm lg:block">
        <h1 className="text-[28px] font-semibold leading-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,.35)]">
          The control plane behind every client you run.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,.3)]">
          Provision organisations, manage platform operators and toggle module entitlements — one level up from any
          single tenant.
        </p>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-sm p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <img src="/ulwembu-logo.png" alt="Ulwembu" className="h-11 w-auto object-contain lg:hidden" />
            <div>
              <h2 className="text-[18px] font-semibold text-text-primary">Sign in to the console</h2>
              <p className="mt-1 text-[13.5px] text-text-secondary">
                Internal only — for the team that provisions client organizations, not staff or org admins.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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
              placeholder="ops@yourcompany.example"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <PasswordInput
              label="Password"
              required
              autoComplete="current-password"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
              Sign in
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
