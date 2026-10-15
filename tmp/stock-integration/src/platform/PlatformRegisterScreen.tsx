import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Mail, User } from "lucide-react";
import { registerPlatformOperator } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { usePlatformAuth } from "./PlatformAuthContext";
import { platformRegisterSchema, type PlatformRegisterValues } from "./validation";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Button } from "@/shared/components/Button";
import { FormRow } from "@/shared/components/FormRow";
import { PulseLine } from "./components/PulseLine";

export function PlatformRegisterScreen() {
  const navigate = useNavigate();
  const { setOperator } = usePlatformAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PlatformRegisterValues>({
    resolver: zodResolver(platformRegisterSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "", confirmPassword: "" },
  });

  const mutation = useMutation({
    mutationFn: registerPlatformOperator,
    onSuccess: (operator) => {
      setOperator(operator);
      navigate("/platform", { replace: true });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = ({ confirmPassword: _confirmPassword, ...values }: PlatformRegisterValues) => {
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

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-lg p-8">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="flex size-11 items-center justify-center rounded-lg bg-brand-500 text-[16px] font-bold text-white">
              U
            </span>
            <div>
              <h1 className="text-[18px] font-semibold text-text-primary">Register the first operator</h1>
              <p className="mt-1 text-[13.5px] text-text-secondary">
                This is available only while the platform has no operators.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {formError && (
              <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
                {formError}
              </div>
            )}

            <FormRow>
              <Input
                label="First name"
                required
                icon={<User className="size-4" aria-hidden />}
                autoComplete="given-name"
                error={errors.firstName?.message}
                {...register("firstName")}
              />
              <Input
                label="Last name"
                required
                autoComplete="family-name"
                error={errors.lastName?.message}
                {...register("lastName")}
              />
            </FormRow>

            <Input
              label="Email"
              required
              type="email"
              icon={<Mail className="size-4" aria-hidden />}
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />

            <FormRow>
              <PasswordInput
                label="Password"
                required
                autoComplete="new-password"
                error={errors.password?.message}
                {...register("password")}
              />
              <PasswordInput
                label="Confirm password"
                required
                autoComplete="new-password"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />
            </FormRow>

            <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
              Create operator
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-text-secondary">
            Already have an operator account?{" "}
            <Link to="/platform/login" className="font-semibold text-brand-600 hover:text-brand-700">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}