import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Building2, Hash, MapPin, Phone, Clock, ArrowLeft } from "lucide-react";
import { addClinicSchema, EMPTY_CLINIC, type AddClinicValues } from "./validation";
import { addOrganizationFacility, getOrganization, type FacilityType } from "@/shared/api/platform";
import { ApiError } from "@/shared/api/client";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";

const TYPE_OPTIONS: { value: FacilityType; label: string }[] = [
  { value: "CLINIC", label: "Clinic" },
  { value: "HOSPITAL", label: "Hospital" },
  { value: "STORE", label: "Store" },
];

// SADM-US-006 — a platform operator adding a clinic to a tenant, from the
// platform console. Same one-screen-per-write shape as
// AddOrganizationAdminScreen, reached from OrganizationDetailPage's own
// "Add clinic" button.
export function AddClinicScreen() {
  const { id } = useParams<{ id: string }>();
  const organizationId = id ?? "";
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const organizationQuery = useQuery({
    queryKey: ["platform", "organizations", organizationId],
    queryFn: () => getOrganization(organizationId),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddClinicValues>({
    resolver: zodResolver(addClinicSchema),
    mode: "onBlur",
    defaultValues: EMPTY_CLINIC,
  });

  const mutation = useMutation({
    mutationFn: (values: AddClinicValues) =>
      addOrganizationFacility(organizationId, {
        name: values.name,
        code: values.code,
        type: values.type as FacilityType,
        address: values.address || undefined,
        phone: values.phone || undefined,
        operatingHours: values.operatingHours || undefined,
      }),
    onSuccess: () => navigate(`/platform/organizations/${organizationId}`),
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: AddClinicValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link
        to={`/platform/organizations/${organizationId}`}
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to organization
      </Link>

      <Card className="p-6 sm:p-8">
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold text-text-primary">Add clinic</h1>
          <p className="mt-1 text-[14px] text-text-secondary">
            {organizationQuery.data
              ? `Adding a clinic to ${organizationQuery.data.displayName}'s facility network.`
              : "Adding a clinic to this organization's facility network."}
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
              label="Clinic name"
              required
              icon={<Building2 className="size-4" aria-hidden />}
              placeholder="Soshanguve Clinic"
              autoComplete="off"
              error={errors.name?.message}
              {...register("name")}
            />
            <Input
              label="Clinic code"
              required
              icon={<Hash className="size-4" aria-hidden />}
              placeholder="SOSH-01"
              autoComplete="off"
              hint="Unique within this tenant"
              error={errors.code?.message}
              {...register("code")}
            />
          </FormRow>

          <Select
            label="Type"
            required
            options={TYPE_OPTIONS}
            placeholder="Select"
            error={errors.type?.message}
            {...register("type")}
          />

          <Input
            label="Physical address"
            icon={<MapPin className="size-4" aria-hidden />}
            placeholder="1 Church St, Soshanguve, Pretoria"
            autoComplete="off"
            error={errors.address?.message}
            {...register("address")}
          />

          <FormRow>
            <Input
              label="Contact number"
              icon={<Phone className="size-4" aria-hidden />}
              placeholder="+27 12 555 1234"
              autoComplete="off"
              error={errors.phone?.message}
              {...register("phone")}
            />
            <Input
              label="Operating hours"
              icon={<Clock className="size-4" aria-hidden />}
              placeholder="Mon–Fri 07:00–16:00"
              autoComplete="off"
              error={errors.operatingHours?.message}
              {...register("operatingHours")}
            />
          </FormRow>

          <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
            Add clinic
          </Button>
        </form>
      </Card>
    </div>
  );
}
