import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Mail, Phone, Hash, CheckCircle2, ArrowLeft, Copy, Plus, X } from "lucide-react";
import { addOrganizationAdminsSchema, EMPTY_ADMIN, type AddOrganizationAdminsValues } from "./validation";
import { addOrganizationAdmins, getOrganization, type ProvisionedAdmin } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import type { Gender } from "@/shared/api/types";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

function ProvisionedAdminCard({ admin }: { admin: ProvisionedAdmin }) {
  const [copied, setCopied] = useState(false);

  const copyPassword = async () => {
    await navigator.clipboard.writeText(admin.temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full rounded-lg border border-border-subtle bg-surface-sunken px-4 py-3 text-left">
      <p className="text-[12px] font-medium uppercase tracking-wide text-text-secondary">Admin email</p>
      <p className="text-[14px] text-text-primary">{admin.email}</p>
      <p className="mt-2.5 text-[12px] font-medium uppercase tracking-wide text-text-secondary">
        Temporary password
      </p>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[14px] text-text-primary">{admin.temporaryPassword}</p>
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
  );
}

// The fix for "client's only admin is locked out / left / wants more
// admins added by us, not by themselves" — targets an organization that
// already exists, unlike ProvisionOrganizationScreen which always creates a
// new one. Takes a list, same as provisioning does — see
// OrganizationProvisioningService.addAdmins() in api-reference.html's
// Platform organizations module.
export function AddOrganizationAdminScreen() {
  const { id } = useParams<{ id: string }>();
  const organizationId = id ?? "";
  const [formError, setFormError] = useState<string | null>(null);

  const organizationQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId],
    queryFn: () => getOrganization(organizationId),
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddOrganizationAdminsValues>({
    resolver: zodResolver(addOrganizationAdminsSchema),
    mode: "onBlur",
    defaultValues: {
      admins: [EMPTY_ADMIN],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "admins" });

  const mutation = useMutation({
    mutationFn: (values: AddOrganizationAdminsValues) =>
      addOrganizationAdmins(organizationId, {
        admins: values.admins.map((admin) => ({ ...admin, gender: admin.gender as Gender })),
      }),
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: AddOrganizationAdminsValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        to={`/platform/organizations/${organizationId}`}
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to organization
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
              <h3 className="text-[16px] font-semibold text-text-primary">
                {mutation.data.admins.length === 1 ? "Admin added" : "Admins added"}
              </h3>
              <p className="max-w-sm text-[14px] text-text-secondary">
                Hand each admin their own credentials below to sign in for the first time. Every temporary password
                is shown once, right here — there's no way to view it again after you leave this page.
              </p>

              <div className="mt-2 flex w-full flex-col gap-3">
                {mutation.data.admins.map((admin) => (
                  <ProvisionedAdminCard key={admin.userId} admin={admin} />
                ))}
              </div>

              <Link
                to={`/platform/organizations/${organizationId}`}
                className="mt-1 inline-flex h-12 w-full items-center justify-center rounded-lg border border-border-strong bg-surface-raised text-[15px] font-semibold text-text-primary transition-colors duration-150 hover:bg-surface-sunken"
              >
                Back to organization
              </Link>
            </motion.div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-[20px] font-semibold text-text-primary">Add admins</h1>
              <p className="mt-1 text-[14px] text-text-secondary">
                {organizationQuery.data
                  ? `Adding one or more ORG_ADMIN accounts to ${organizationQuery.data.displayName}.`
                  : "Adding one or more ORG_ADMIN accounts to this organization."}
              </p>
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

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-text-primary">Admins</h2>
                  <p className="text-[12.5px] text-text-secondary">
                    {fields.length} admin{fields.length === 1 ? "" : "s"}
                  </p>
                </div>
                {errors.admins?.root?.message || errors.admins?.message ? (
                  <p className="text-[13px] text-danger-600">
                    {errors.admins?.root?.message ?? errors.admins?.message}
                  </p>
                ) : null}

                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-sunken p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[13px] font-semibold text-text-secondary">Admin {index + 1}</p>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-danger-600 hover:text-danger-700"
                        >
                          <X className="size-3.5" aria-hidden />
                          Remove
                        </button>
                      )}
                    </div>

                    <FormRow>
                      <Input
                        label="First name"
                        required
                        icon={<User className="size-4" aria-hidden />}
                        placeholder="Sipho"
                        autoComplete="off"
                        error={errors.admins?.[index]?.firstName?.message}
                        {...register(`admins.${index}.firstName`)}
                      />
                      <Input
                        label="Last name"
                        required
                        placeholder="Dlamini"
                        autoComplete="off"
                        error={errors.admins?.[index]?.lastName?.message}
                        {...register(`admins.${index}.lastName`)}
                      />
                    </FormRow>

                    <FormRow>
                      <Input
                        label="Employee number"
                        required
                        icon={<Hash className="size-4" aria-hidden />}
                        placeholder="P100235"
                        autoComplete="off"
                        error={errors.admins?.[index]?.employeeNumber?.message}
                        {...register(`admins.${index}.employeeNumber`)}
                      />
                      <Input
                        label="Email"
                        required
                        type="email"
                        icon={<Mail className="size-4" aria-hidden />}
                        placeholder="s.dlamini@tshwane.gov.za"
                        autoComplete="off"
                        error={errors.admins?.[index]?.email?.message}
                        {...register(`admins.${index}.email`)}
                      />
                    </FormRow>

                    <FormRow>
                      <Input
                        label="Contact number"
                        required
                        icon={<Phone className="size-4" aria-hidden />}
                        placeholder="+27 82 765 4321"
                        autoComplete="off"
                        error={errors.admins?.[index]?.contactNumber?.message}
                        {...register(`admins.${index}.contactNumber`)}
                      />
                      <Select
                        label="Gender"
                        required
                        options={GENDER_OPTIONS}
                        placeholder="Select"
                        error={errors.admins?.[index]?.gender?.message}
                        {...register(`admins.${index}.gender`)}
                      />
                    </FormRow>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="ghost"
                  icon={<Plus className="size-4" aria-hidden />}
                  onClick={() => append(EMPTY_ADMIN)}
                  className="self-start"
                >
                  Add another admin
                </Button>
              </div>

              <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
                Add {fields.length === 1 ? "admin" : "admins"}
              </Button>
            </form>
          </Card>
        )}
    </div>
  );
}
