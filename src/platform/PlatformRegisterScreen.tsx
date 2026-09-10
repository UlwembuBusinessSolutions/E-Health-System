import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Mail, User } from "lucide-react";
import { registerPlatformOperator } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { platformRegisterSchema, type PlatformRegisterValues } from "./validation";
import { usePlatformAuth } from "./PlatformAuthContext";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PasswordInput } from "@/shared/components/PasswordInput";
import { Button } from "@/shared/components/Button";

export function PlatformRegisterScreen() {
  const navigate = useNavigate();
  const { setOperator } = usePlatformAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PlatformRegisterValues>({
    resolver: zodResolver(platformRegisterSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
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

  const onSubmit = (values: PlatformRegisterValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "24px 24px" }} aria-hidden />
      <Card className="relative w-full max-w-md p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-lg bg-brand-500 text-[16px] font-bold text-white">U</span>
          <div>
            <h1 className="text-[18px] font-semibold text-text-primary">Create platform account</h1>
            <p className="mt-1 text-[13.5px] text-text-secondary">Set up the first account for the Ulwembu platform console.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {formError && <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">{formError}</div>}
          <Input label="First name" required icon={<User className="size-4" aria-hidden />} error={errors.firstName?.message} {...register("firstName")} />
          <Input label="Last name" required icon={<User className="size-4" aria-hidden />} error={errors.lastName?.message} {...register("lastName")} />
          <Input label="Email" required type="email" icon={<Mail className="size-4" aria-hidden />} autoComplete="email" error={errors.email?.message} {...register("email")} />
          <PasswordInput label="Password" required autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">Create account</Button>
          <Link to="/platform/login" className="text-center text-[13px] font-medium text-brand-600 hover:text-brand-700">Back to sign in</Link>
        </form>
      </Card>
    </div>
  );
}
