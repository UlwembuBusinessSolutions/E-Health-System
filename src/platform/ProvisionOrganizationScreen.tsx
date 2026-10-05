import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, User, Mail, Phone, Hash, CheckCircle2, ArrowLeft, Copy, Plus, X, LayoutGrid } from "lucide-react";
import { provisionOrganizationSchema, EMPTY_ADMIN, type ProvisionOrganizationValues } from "./validation";
import {
  provisionOrganization,
  checkSlugAvailable,
  uploadOrganizationLogo,
  type OrganizationSector,
  type ProvisionedAdmin,
  type ProvisionedOrganization,
} from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import type { Gender } from "@/shared/api/types";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";
import { PhotoCapture } from "@/shared/components/PhotoCapture";
import { SECTOR_OPTIONS, SECTOR_DEFAULT_MODULES } from "./components/SectorTag";

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

// Creates a tenant and one or more ORG_ADMIN accounts for it in one call —
// see OrganizationProvisioningService.provisionOrganization() in
// api-reference.html's Platform organizations module. Unlike the
// staff-creation form, there's no password field here: the backend
// generates each admin's temporary password and returns it exactly once,
// which is why the success state below treats every one as something to
// copy now, not something recoverable later.
export function ProvisionOrganizationScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    getValues,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProvisionOrganizationValues>({
    resolver: zodResolver(provisionOrganizationSchema),
    mode: "onBlur",
    defaultValues: {
      slug: "",
      displayName: "",
      sector: "",
      admins: [EMPTY_ADMIN],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "admins" });
  const selectedSector = watch("sector") as OrganizationSector | "";
  const defaultModules = selectedSector ? SECTOR_DEFAULT_MODULES[selectedSector] : null;

  const mutation = useMutation({
    mutationFn: provisionOrganization,
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  // A separate mutation, not folded into the one above — an org has no id
  // for a file to attach to until provisionOrganization returns (same
  // reasoning as AddStaffScreen's own photoMutation), so this is always a
  // follow-up call. Fired automatically the moment provisioning succeeds
  // when a logo was picked up front; never blocks showing the admin
  // credentials below, which matter more and are only ever shown once.
  const logoMutation = useMutation({
    mutationFn: ({ organizationId, file }: { organizationId: string; file: File }) =>
      uploadOrganizationLogo(organizationId, file),
  });

  const onSubmit = (values: ProvisionOrganizationValues) => {
    setFormError(null);
    mutation.mutate(
      {
        ...values,
        sector: values.sector as OrganizationSector,
        admins: values.admins.map((admin) => ({ ...admin, gender: admin.gender as Gender })),
      },
      {
        onSuccess: (organization: ProvisionedOrganization) => {
          if (logoFile) {
            logoMutation.mutate({ organizationId: organization.organizationId, file: logoFile });
          }
        },
      },
    );
  };

  const checkSlug = async () => {
    const valid = await trigger("slug");
    if (!valid) return;
    setCheckingSlug(true);
    const available = await checkSlugAvailable(getValues("slug"));
    setCheckingSlug(false);
    if (!available) {
      setError("slug", { type: "manual", message: "This slug is already in use." });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        to="/platform/organizations"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to organizations
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
              <h3 className="text-[16px] font-semibold text-text-primary">Organization created</h3>
              <p className="max-w-sm text-[14px] text-text-secondary">
                {mutation.data.admins.length === 1
                  ? "Hand these credentials to the admin below to sign in for the first time."
                  : `Hand each admin their own credentials below to sign in for the first time.`}{" "}
                Every temporary password is shown once, right here — there's no way to view it again after you leave
                this page.
              </p>

              <div className="mt-2 flex w-full flex-col gap-3">
                {mutation.data.admins.map((admin) => (
                  <ProvisionedAdminCard key={admin.userId} admin={admin} />
                ))}
              </div>

              {logoFile && (
                <p className={`text-[12.5px] ${logoMutation.isError ? "text-danger-600" : "text-text-secondary"}`}>
                  {logoMutation.isPending
                    ? "Uploading logo…"
                    : logoMutation.isError
                      ? "Couldn't upload the logo — add it from the organization's page."
                      : logoMutation.isSuccess
                        ? "Logo uploaded."
                        : null}
                </p>
              )}

              <Button
                variant="secondary"
                size="lg"
                className="mt-1 w-full"
                onClick={() => {
                  mutation.reset();
                  logoMutation.reset();
                  setLogoFile(null);
                }}
              >
                Provision another organization
              </Button>
            </motion.div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-[20px] font-semibold text-text-primary">New organization</h1>
              <p className="mt-1 text-[14px] text-text-secondary">
                Provisions the tenant schema and creates one or more admin accounts for it in one step.
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

              <FormRow>
                <Input
                  label="Slug"
                  required
                  icon={<Building2 className="size-4" aria-hidden />}
                  placeholder="cot"
                  autoComplete="off"
                  hint={checkingSlug ? "Checking availability…" : "Lowercase letters, digits, hyphens only"}
                  error={errors.slug?.message}
                  {...register("slug", { onBlur: checkSlug })}
                />
                <Input
                  label="Display name"
                  required
                  placeholder="City of Tshwane Clinics"
                  error={errors.displayName?.message}
                  {...register("displayName")}
                />
              </FormRow>

              <div className="flex flex-col items-center gap-2 rounded-lg border border-border-subtle bg-surface-sunken p-4">
                <p className="self-start text-[13px] font-semibold text-text-secondary">Logo (optional)</p>
                <PhotoCapture
                  file={logoFile}
                  onChange={setLogoFile}
                  disabled={mutation.isPending}
                  allowCamera={false}
                  placeholderIcon={Building2}
                  uploadLabel="Upload logo"
                  replaceLabel="Replace logo"
                />
                <p className="text-center text-[12px] text-text-secondary">
                  JPEG, PNG, or WebP, up to 5MB. Can be added or changed later from the organization's page.
                </p>
              </div>

              <Select
                label="Sector"
                required
                options={SECTOR_OPTIONS}
                placeholder="Select"
                hint="Public, private or occupational — used for sector-appropriate defaults."
                error={errors.sector?.message}
                {...register("sector")}
              />

              {defaultModules && (
                <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-sunken p-4">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="size-4 text-text-secondary" aria-hidden />
                    <p className="text-[13px] font-semibold text-text-primary">
                      Modules enabled by default for this sector
                    </p>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {defaultModules.map((module) => (
                      <li
                        key={module.code}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700"
                        title={module.label}
                      >
                        {module.label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] text-text-secondary">
                    Any module can be switched on or off afterwards from the organization's detail page.
                  </p>
                </div>
              )}

              <div className="mt-2 flex flex-col gap-4">
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
                        placeholder="Thandiwe"
                        autoComplete="off"
                        error={errors.admins?.[index]?.firstName?.message}
                        {...register(`admins.${index}.firstName`)}
                      />
                      <Input
                        label="Last name"
                        required
                        placeholder="Nkosi"
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
                        placeholder="P100234"
                        autoComplete="off"
                        error={errors.admins?.[index]?.employeeNumber?.message}
                        {...register(`admins.${index}.employeeNumber`)}
                      />
                      <Input
                        label="Email"
                        required
                        type="email"
                        icon={<Mail className="size-4" aria-hidden />}
                        placeholder="t.nkosi@tshwane.gov.za"
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
                        placeholder="+27 82 123 4567"
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
                Create organization
              </Button>
            </form>
          </Card>
        )}
    </div>
  );
}
