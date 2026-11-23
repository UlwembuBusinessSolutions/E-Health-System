import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { ArrowLeft, UserPlus } from "lucide-react";
import { createOrganizationStaff, listOrganizationFacilities, listOrganizationStaffRoles, listOrganizations } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import type { Gender } from "@/shared/api/types";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";

const schema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
  facilityId: z.string().min(1, "Select a clinic"),
  roleId: z.string().min(1, "Select a role"),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  employeeNumber: z.string().trim().min(1, "Employee number is required").max(30),
  email: z.string().trim().email("Enter a valid email address"),
  contactNumber: z.string().trim().regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number"),
  gender: z.string().min(1, "Select a gender"),
  department: z.string().trim().max(100),
  designation: z.string().trim().max(100),
  temporaryPassword: z.string().min(8, "At least 8 characters").regex(/[A-Za-z]/, "Include a letter").regex(/[0-9]/, "Include a number"),
  confirmTemporaryPassword: z.string().min(1, "Confirm the temporary password"),
}).refine(value => value.temporaryPassword === value.confirmTemporaryPassword, {
  message: "Passwords do not match",
  path: ["confirmTemporaryPassword"],
});

type Values = z.infer<typeof schema>;
const genderOptions: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export function CreateOrganizationStaffPage() {
  const [formError, setFormError] = useState("");
  const organizationsQuery = useQuery({
    queryKey: ["platform", "organizations", "staff-picker"],
    queryFn: () => listOrganizations({ status: "ACTIVE", sort: "newest" }),
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationId: "",
      facilityId: "",
      roleId: "",
      firstName: "",
      lastName: "",
      employeeNumber: "",
      email: "",
      contactNumber: "",
      gender: "",
      department: "",
      designation: "",
      temporaryPassword: "",
      confirmTemporaryPassword: "",
    },
  });

  const organizationId = watch("organizationId");
  const facilitiesQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId, "active-facilities"],
    queryFn: async () => (await listOrganizationFacilities(organizationId)).filter(facility => facility.active),
    enabled: !!organizationId,
  });
  const rolesQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId, "staff-roles"],
    queryFn: () => listOrganizationStaffRoles(organizationId),
    enabled: !!organizationId,
  });

  const createMutation = useMutation({
    mutationFn: (values: Values) => createOrganizationStaff(values.organizationId, {
      firstName: values.firstName,
      lastName: values.lastName,
      employeeNumber: values.employeeNumber,
      email: values.email,
      contactNumber: values.contactNumber,
      gender: values.gender as Gender,
      facilityId: values.facilityId,
      roleId: values.roleId,
      department: values.department || undefined,
      designation: values.designation || undefined,
      temporaryPassword: values.temporaryPassword,
    }),
    onError: error => setFormError(error instanceof ApiError ? error.message : "Could not create the staff account. Please try again."),
  });

  const organizations = organizationsQuery.data ?? [];
  const activeFacilities = facilitiesQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link to="/platform/organizations" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary">
        <ArrowLeft className="size-4" aria-hidden />
        Back to organizations
      </Link>
      <header className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-border-subtle bg-surface-raised text-brand-600">
          <UserPlus className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-text-primary">Create staff account</h1>
          <p className="mt-1 text-[14px] text-text-secondary">Choose an organization and one of its active clinics.</p>
        </div>
      </header>

      <Card className="p-6 sm:p-8">
        {organizationsQuery.isError ? (
          <div role="alert" className="space-y-3">
            <p className="text-[14px] text-danger-600">
              {organizationsQuery.error instanceof ApiError
                ? `Organizations could not be loaded: ${organizationsQuery.error.message}`
                : "Organizations could not be loaded."}
            </p>
            <Button type="button" variant="secondary" loading={organizationsQuery.isFetching} onClick={() => void organizationsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : organizationsQuery.isLoading ? (
          <p role="status" className="text-[14px] text-text-secondary">Loading organizations…</p>
        ) : organizations.length === 0 ? (
          <p role="status" className="text-[14px] text-text-secondary">There are no active organizations available.</p>
        ) : (
          <form noValidate onSubmit={handleSubmit(values => { setFormError(""); createMutation.mutate(values); })} className="space-y-5">
            {formError && <p role="alert" className="rounded-lg bg-danger-50 p-3 text-[14px] text-danger-600">{formError}</p>}

            <fieldset disabled={createMutation.isPending} className="min-w-0 space-y-5">
              <FormRow>
                <Select
                  label="Organization"
                  required
                  placeholder="Select organization"
                  options={organizations.map(organization => ({ value: organization.id, label: organization.displayName }))}
                  error={errors.organizationId?.message}
                  {...register("organizationId", {
                    onChange: () => {
                      setValue("facilityId", "");
                      setValue("roleId", "");
                    },
                  })}
                />
                <Select
                  label="Clinic"
                  required
                  placeholder={!organizationId ? "Select an organization first" : facilitiesQuery.isLoading ? "Loading clinics…" : facilitiesQuery.isError ? "Unable to load clinics" : activeFacilities.length ? "Select clinic" : "No active clinics"}
                  disabled={!organizationId || facilitiesQuery.isLoading || facilitiesQuery.isError || activeFacilities.length === 0}
                  options={activeFacilities.map(facility => ({ value: facility.id, label: facility.name }))}
                  error={errors.facilityId?.message}
                  {...register("facilityId")}
                />
              </FormRow>

              {organizationId && facilitiesQuery.isError && (
                <div role="alert" className="flex flex-wrap items-center gap-2 text-[13px] text-danger-600">
                  <span>{facilitiesQuery.error instanceof ApiError ? facilitiesQuery.error.message : "Clinics could not be loaded."}</span>
                  <Button type="button" variant="ghost" loading={facilitiesQuery.isFetching} onClick={() => void facilitiesQuery.refetch()}>Retry</Button>
                </div>
              )}
              {organizationId && facilitiesQuery.isSuccess && activeFacilities.length === 0 && (
                <p role="status" className="text-[13px] text-text-secondary">This organization has no active clinics. Add or activate one from its organization page.</p>
              )}

              <Select
                label="Role"
                required
                placeholder={!organizationId ? "Select an organization first" : rolesQuery.isLoading ? "Loading roles…" : rolesQuery.isError ? "Unable to load roles" : "Select role"}
                disabled={!organizationId || rolesQuery.isLoading || rolesQuery.isError || roles.length === 0}
                options={roles.map(role => ({ value: role.id, label: role.name }))}
                error={errors.roleId?.message}
                {...register("roleId")}
              />
              {organizationId && rolesQuery.isError && (
                <div role="alert" className="flex flex-wrap items-center gap-2 text-[13px] text-danger-600">
                  <span>{rolesQuery.error instanceof ApiError ? rolesQuery.error.message : "Roles could not be loaded."}</span>
                  <Button type="button" variant="ghost" loading={rolesQuery.isFetching} onClick={() => void rolesQuery.refetch()}>Retry</Button>
                </div>
              )}

              <FormRow>
                <Input label="First name" required error={errors.firstName?.message} {...register("firstName")} />
                <Input label="Last name" required error={errors.lastName?.message} {...register("lastName")} />
              </FormRow>
              <FormRow>
                <Input label="Employee number" required error={errors.employeeNumber?.message} {...register("employeeNumber")} />
                <Input label="Email" type="email" required error={errors.email?.message} {...register("email")} />
              </FormRow>
              <FormRow>
                <Input label="Contact number" type="tel" required error={errors.contactNumber?.message} {...register("contactNumber")} />
                <Select label="Gender" required options={genderOptions} error={errors.gender?.message} {...register("gender")} />
              </FormRow>
              <FormRow>
                <Input label="Department" error={errors.department?.message} {...register("department")} />
                <Input label="Designation" error={errors.designation?.message} {...register("designation")} />
              </FormRow>
              <FormRow>
                <Input label="Temporary password" type="password" required hint="At least 8 characters, including a letter and a number." error={errors.temporaryPassword?.message} {...register("temporaryPassword")} />
                <Input label="Confirm temporary password" type="password" required error={errors.confirmTemporaryPassword?.message} {...register("confirmTemporaryPassword")} />
              </FormRow>
            </fieldset>

            <Button type="submit" size="lg" loading={createMutation.isPending} className="w-full">
              Create staff account
            </Button>
            {createMutation.isSuccess && (
              <p role="status" className="rounded-lg bg-success-50 p-3 text-[14px] text-success-600">
                Account created for {createMutation.data.firstName} {createMutation.data.lastName} in {organizations.find(organization => organization.id === organizationId)?.displayName}.
              </p>
            )}
          </form>
        )}
      </Card>
    </div>
  );
}
