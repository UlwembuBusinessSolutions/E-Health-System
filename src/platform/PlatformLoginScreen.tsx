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
import { PulseLine } from "./components/PulseLine";

// Deliberately not AuthLayout — that layout is built around a tenant's own
// branding (useTenant() inside it), which is exactly wrong for a screen
// that isn't scoped to any tenant at all; this is the one identity space
// that's Ulwembu's own. The visual language here is the Platform Console's
// (ink-900, brand teal, IBM Plex via .platform-shell — see PlatformRoot),
// not the clinic-facing app's — a platform operator lands on the dark
// sidebar console immediately after this, so the login itself commits to
// that register rather than borrowing the tenant login's photographic one.
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
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        aria-hidden
      />
      <PulseLine className="pointer-events-none absolute inset-x-0 top-1/2 h-32 w-full -translate-y-1/2 text-brand-500/25 lg:h-44" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(23,25,22,0) 0%, rgba(23,25,22,.55) 65%, rgba(23,25,22,.92) 100%)" }}
        aria-hidden
      />

      <div className="absolute left-8 top-8 z-10 hidden items-center gap-2.5 lg:flex">
        <span className="flex size-8 items-center justify-center rounded-md bg-brand-500 text-[13px] font-bold text-white">
          U
        </span>
        <div className="leading-tight">
          <p className="text-[13.5px] font-semibold text-ink-50">Ulwembu</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-ink-500">Platform console</p>
        </div>
      </div>

      <div className="absolute bottom-14 left-8 z-10 hidden max-w-sm lg:block">
        <h1 className="text-[28px] font-semibold leading-tight text-ink-50">
          The control plane behind every client you run.
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-400">
          Provision organisations, manage platform operators and toggle module entitlements — one level up from any
          single tenant.
        </p>
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-sm p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-500 text-[16px] font-bold text-white">
              U
            </span>
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
