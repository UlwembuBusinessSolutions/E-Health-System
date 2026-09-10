import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Copy, Mail, ShieldPlus, User } from "lucide-react";
import { createOperatorSchema, type CreateOperatorValues } from "./validation";
import { createPlatformOperator } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";

// Same shape as ProvisionOrganizationScreen/AddOrganizationAdminScreen: no
// password field, because PlatformOperatorService generates the temporary
// one and returns it exactly once. A platform operator is the one identity
// this console can grant — nothing scopes it to an organization, so unlike
// those two forms there's no tenant context to carry into the request.
export function CreateOperatorScreen() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateOperatorValues>({
    resolver: zodResolver(createOperatorSchema),
    mode: "onBlur",
    defaultValues: { firstName: "", lastName: "", email: "" },
  });

  const mutation = useMutation({
    mutationFn: createPlatformOperator,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "operators"] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: CreateOperatorValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  const copyPassword = async () => {
    if (!mutation.data) return;
    await navigator.clipboard.writeText(mutation.data.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        to="/platform/users"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to users
      </Link>

      {mutation.isSuccess ? (
        <Card className="p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center gap-3 text-center"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
              <CheckCircle2 className="size-6" aria-hidden />
            </span>
            <h3 className="text-[16px] font-semibold text-text-primary">Operator created</h3>
            <p className="max-w-sm text-[14px] text-text-secondary">
              Hand these credentials to {mutation.data.firstName} to sign in for the first time. The temporary
              password is shown once, right here — there's no way to view it again after you leave this page.
            </p>

            <div className="mt-2 w-full rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3 text-left">
              <p className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">Email</p>
              <p className="text-[14px] text-text-primary">{mutation.data.email}</p>
              <p className="mt-2.5 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                Temporary password
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono text-[14px] text-text-primary">{mutation.data.temporaryPassword}</p>
                <button
                  type="button"
                  onClick={copyPassword}
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand-600 hover:text-brand-700"
                >
                  <Copy className="size-3.5" aria-hidden />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <Link
              to="/platform/users"
              className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-lg border border-border-strong bg-surface-raised text-[15px] font-semibold text-text-primary transition-colors duration-150 hover:bg-surface-sunken"
            >
              Back to users
            </Link>
          </motion.div>
        </Card>
      ) : (
        <Card className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <ShieldPlus className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-[20px] font-semibold text-text-primary">New operator</h1>
              <p className="mt-0.5 text-[14px] text-text-secondary">
                Grants access to the platform console itself — not scoped to any organization.
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

            <FormRow>
              <Input
                label="First name"
                required
                icon={<User className="size-4" aria-hidden />}
                placeholder="Naledi"
                autoComplete="off"
                error={errors.firstName?.message}
                {...register("firstName")}
              />
              <Input
                label="Last name"
                required
                placeholder="Mahlangu"
                autoComplete="off"
                error={errors.lastName?.message}
                {...register("lastName")}
              />
            </FormRow>

            <Input
              label="Email"
              required
              type="email"
              icon={<Mail className="size-4" aria-hidden />}
              placeholder="n.mahlangu@ulwembubs.com"
              autoComplete="off"
              hint="Where the sign-in link and temporary password are sent."
              error={errors.email?.message}
              {...register("email")}
            />

            <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
              Create operator
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
