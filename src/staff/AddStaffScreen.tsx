import { useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { User, Mail, Phone, Hash, CheckCircle2, ArrowLeft, Camera, Loader2 } from "lucide-react";
import { createStaffSchema, type CreateStaffValues } from "./validation";
import {
  createStaff,
  checkEmployeeNumberAvailable,
  checkStaffEmailAvailable,
  checkStaffContactAvailable,
  uploadStaffPhoto,
  type EmploymentType,
  type StaffSummary,
} from "@/shared/api/staff";
import { getFacilities } from "@/shared/api/facilities";
import { getRoles } from "@/shared/api/roles";
import { ApiError } from "@/shared/api/client";
import type { Gender } from "@/shared/api/types";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";
import { PhotoCapture } from "@/shared/components/PhotoCapture";

type UniqueField = "employeeNumber" | "email" | "contactNumber";

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "PERMANENT", label: "Permanent" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
  { value: "COMMUNITY_SERVICE", label: "Community service" },
  { value: "EXTENDED_PUBLIC_WORKS", label: "Extended public works" },
  { value: "SECONDED", label: "Seconded" },
];

// Admin-only staff profile creation. Credentials are completed by the new
// staff member through the one-time link sent after creation.
export function AddStaffScreen() {
  const [formError, setFormError] = useState<string | null>(null);
  const [checkingField, setCheckingField] = useState<UniqueField | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [additionalFacilityIds, setAdditionalFacilityIds] = useState<string[]>([]);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: getRoles });

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateStaffValues>({
    resolver: zodResolver(createStaffSchema),
    mode: "onBlur",
    defaultValues: {
      firstName: "",
      lastName: "",
      employeeNumber: "",
      idNumber: "",
      email: "",
      contactNumber: "",
      gender: "",
      dateOfBirth: "",
      employmentStartDate: "",
      employmentType: "",
      facilityId: "",
      department: "",
      designation: "",
      roleId: "",
      sancNumber: "",
      sancExpiryDate: "",
      hpcsaNumber: "",
      hpcsaExpiryDate: "",
      sapcNumber: "",
      sapcExpiryDate: "",
      emergencyContactName: "",
      emergencyContactRelationship: "",
      emergencyContactPhone: "",
    },
  });
  const selectedFacilityId = watch("facilityId");

  const mutation = useMutation({
    mutationFn: createStaff,
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  // A separate mutation, not folded into the one above — the photo can
  // only be uploaded once the staff id comes back from createStaff (see
  // backend-auth-guide.html Section 7's why-note on the deterministic S3
  // key), so it's always a follow-up call. When a photo was picked on the
  // create form (PhotoCapture below), onSubmit fires it automatically the
  // moment createStaff succeeds — this handler stays for the success
  // screen's "add/replace" fallback, for whoever didn't pick one up front.
  const photoMutation = useMutation({
    mutationFn: ({ staffId, file }: { staffId: string; file: File }) => uploadStaffPhoto(staffId, file),
  });

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !mutation.data) return;
    photoMutation.mutate({ staffId: mutation.data.id, file });
  };

  const onSubmit = (values: CreateStaffValues) => {
    setFormError(null);
    mutation.mutate(
      {
        firstName: values.firstName,
        lastName: values.lastName,
        employeeNumber: values.employeeNumber,
        idNumber: values.idNumber || undefined,
        email: values.email,
        contactNumber: values.contactNumber,
        gender: values.gender as Gender,
        dateOfBirth: values.dateOfBirth || undefined,
        employmentStartDate: values.employmentStartDate || undefined,
        employmentType: (values.employmentType || undefined) as EmploymentType | undefined,
        facilityId: values.facilityId,
        additionalFacilityIds: additionalFacilityIds.filter((id) => id !== values.facilityId),
        department: values.department || undefined,
        designation: values.designation || undefined,
        roleId: values.roleId,
        sancNumber: values.sancNumber || undefined,
        sancExpiryDate: values.sancExpiryDate || undefined,
        hpcsaNumber: values.hpcsaNumber || undefined,
        hpcsaExpiryDate: values.hpcsaExpiryDate || undefined,
        sapcNumber: values.sapcNumber || undefined,
        sapcExpiryDate: values.sapcExpiryDate || undefined,
        emergencyContactName: values.emergencyContactName || undefined,
        emergencyContactRelationship: values.emergencyContactRelationship || undefined,
        emergencyContactPhone: values.emergencyContactPhone || undefined,
      },
      {
        onSuccess: (staff: StaffSummary) => {
          if (photoFile) {
            photoMutation.mutate({ staffId: staff.id, file: photoFile });
          }
        },
      },
    );
  };

  const checkUniqueness = async (
    field: UniqueField,
    checker: (value: string) => Promise<boolean>,
    message: string,
  ) => {
    const valid = await trigger(field);
    if (!valid) return;
    setCheckingField(field);
    const available = await checker(getValues(field));
    setCheckingField((current) => (current === field ? null : current));
    if (!available) {
      setError(field, { type: "manual", message });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          to="/app/staff"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to staff
        </Link>
      </div>

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
              <h3 className="text-[16px] font-semibold text-text-primary">Staff account created</h3>
              <p className="max-w-sm text-[14px] text-text-secondary">
                {mutation.data.firstName} {mutation.data.lastName} was created. A password setup link has been emailed
                to {mutation.data.email}; they must choose their password before signing in.
              </p>

              <div className="mt-1 flex flex-col items-center gap-2">
                <label
                  htmlFor="staff-photo-input"
                  className="flex size-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong bg-surface-sunken text-text-secondary transition-colors duration-150 hover:border-brand-400 hover:text-brand-600"
                >
                  {photoMutation.data ? (
                    <img
                      src={photoMutation.data.profilePhotoUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : photoMutation.isPending ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : (
                    <Camera className="size-5" aria-hidden />
                  )}
                  <input
                    id="staff-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </label>
                <p className="text-[13px] text-text-secondary">
                  {photoMutation.isPending
                    ? "Uploading photo…"
                    : photoMutation.data
                      ? "Photo added — click to replace."
                      : "Add a photo (optional). JPEG, PNG, or WebP, up to 5MB."}
                </p>
                {photoMutation.isError && (
                  <p role="alert" className="text-[13px] text-danger-600">
                    {photoMutation.error instanceof Error
                      ? photoMutation.error.message
                      : "Something went wrong. Please try again."}
                  </p>
                )}
              </div>

              <Button
                variant="secondary"
                size="lg"
                className="mt-1 w-full"
                onClick={() => {
                  mutation.reset();
                  photoMutation.reset();
                  setPhotoFile(null);
                  setAdditionalFacilityIds([]);
                }}
              >
                Add another staff member
              </Button>
            </motion.div>
          </Card>
        ) : (
          <Card className="p-6 sm:p-8">
            <div className="mb-6">
              <h1 className="text-[20px] font-semibold text-text-primary">Add staff member</h1>
              <p className="mt-1 text-[14px] text-text-secondary">
                Creates the account, assigns the selected clinic and role, and emails a one-time password setup link.
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

              <div className="flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-4">
                <p className="text-[13px] font-semibold text-text-secondary">Staff photo (optional)</p>
                <PhotoCapture file={photoFile} onChange={setPhotoFile} disabled={mutation.isPending} />
                <p className="max-w-xs text-center text-[12.5px] text-text-secondary">
                  Uploaded automatically once the account is created — no separate step.
                </p>
              </div>

              <FormRow>
                <Input
                  label="First name"
                  required
                  icon={<User className="size-4" aria-hidden />}
                  placeholder="Karabo"
                  autoComplete="given-name"
                  error={errors.firstName?.message}
                  {...register("firstName")}
                />
                <Input
                  label="Last name"
                  required
                  placeholder="Molefe"
                  autoComplete="family-name"
                  error={errors.lastName?.message}
                  {...register("lastName")}
                />
              </FormRow>

              <FormRow>
                <Input
                  label="Employee number"
                  required
                  icon={<Hash className="size-4" aria-hidden />}
                  placeholder="P100522"
                  autoComplete="off"
                  error={errors.employeeNumber?.message}
                  hint={checkingField === "employeeNumber" ? "Checking availability…" : undefined}
                  {...register("employeeNumber", {
                    onBlur: () =>
                      checkUniqueness(
                        "employeeNumber",
                        checkEmployeeNumberAvailable,
                        "This employee number is already in use.",
                      ),
                  })}
                />
                <Input
                  label="Email"
                  required
                  type="email"
                  icon={<Mail className="size-4" aria-hidden />}
                  placeholder="k.molefe@clinic.org"
                  autoComplete="email"
                  error={errors.email?.message}
                  hint={checkingField === "email" ? "Checking availability…" : undefined}
                  {...register("email", {
                    onBlur: () =>
                      checkUniqueness("email", checkStaffEmailAvailable, "This email address is already in use."),
                  })}
                />
              </FormRow>

              <FormRow>
                <Input
                  label="Contact number"
                  required
                  icon={<Phone className="size-4" aria-hidden />}
                  placeholder="+27 82 123 4567"
                  autoComplete="tel"
                  error={errors.contactNumber?.message}
                  hint={checkingField === "contactNumber" ? "Checking availability…" : undefined}
                  {...register("contactNumber", {
                    onBlur: () =>
                      checkUniqueness(
                        "contactNumber",
                        checkStaffContactAvailable,
                        "This contact number is already registered.",
                      ),
                  })}
                />
                <Select
                  label="Gender"
                  required
                  options={GENDER_OPTIONS}
                  placeholder="Select"
                  error={errors.gender?.message}
                  {...register("gender")}
                />
              </FormRow>

              <FormRow>
                <Input
                  label="ID number"
                  hint="13-digit SA ID number, if available"
                  error={errors.idNumber?.message}
                  {...register("idNumber")}
                />
                <Input
                  label="Date of birth"
                  type="date"
                  error={errors.dateOfBirth?.message}
                  {...register("dateOfBirth")}
                />
              </FormRow>

              <FormRow>
                <Select
                  label="Clinic"
                  required
                  placeholder={facilitiesQuery.isLoading ? "Loading clinics…" : "Select clinic"}
                  disabled={facilitiesQuery.isLoading}
                  options={(facilitiesQuery.data ?? []).map((f) => ({ value: f.id, label: f.name }))}
                  error={errors.facilityId?.message}
                  {...register("facilityId")}
                />
                <Select
                  label="Role"
                  required
                  placeholder={rolesQuery.isLoading ? "Loading roles…" : "Select role"}
                  disabled={rolesQuery.isLoading}
                  options={(rolesQuery.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
                  error={errors.roleId?.message}
                  {...register("roleId")}
                />
              </FormRow>

              {(facilitiesQuery.data ?? []).length > 1 && (
                <fieldset className="rounded-lg border border-border-subtle bg-surface-sunken p-4">
                  <legend className="px-1 text-[13px] font-semibold text-text-secondary">Additional clinics</legend>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(facilitiesQuery.data ?? [])
                      .filter((facility) => facility.id !== selectedFacilityId)
                      .map((facility) => (
                      <label key={facility.id} className="flex items-center gap-2 text-[13.5px] text-text-primary">
                        <input
                          type="checkbox"
                          checked={additionalFacilityIds.includes(facility.id)}
                          onChange={(event) =>
                            setAdditionalFacilityIds((current) =>
                              event.target.checked
                                ? [...current, facility.id]
                                : current.filter((id) => id !== facility.id),
                            )
                          }
                          className="size-4 accent-brand-500"
                        />
                        {facility.name}
                      </label>
                      ))}
                  </div>
                </fieldset>
              )}

              <FormRow>
                <Input label="Department" placeholder="Outpatients" error={errors.department?.message} {...register("department")} />
                <Input
                  label="Designation"
                  placeholder="Professional Nurse"
                  error={errors.designation?.message}
                  {...register("designation")}
                />
              </FormRow>

              <FormRow>
                <Input
                  label="Employment start date"
                  type="date"
                  error={errors.employmentStartDate?.message}
                  {...register("employmentStartDate")}
                />
                <Select
                  label="Employment type"
                  placeholder="Select"
                  options={EMPLOYMENT_TYPE_OPTIONS}
                  error={errors.employmentType?.message}
                  {...register("employmentType")}
                />
              </FormRow>

              <FormRow>
                <Input
                  label="SANC number"
                  hint="Nurses only — leave blank otherwise"
                  error={errors.sancNumber?.message}
                  {...register("sancNumber")}
                />
                <Input
                  label="SANC expiry date"
                  type="date"
                  error={errors.sancExpiryDate?.message}
                  {...register("sancExpiryDate")}
                />
              </FormRow>

              <FormRow>
                <Input
                  label="HPCSA number"
                  hint="Doctors/allied health only"
                  error={errors.hpcsaNumber?.message}
                  {...register("hpcsaNumber")}
                />
                <Input
                  label="HPCSA expiry date"
                  type="date"
                  error={errors.hpcsaExpiryDate?.message}
                  {...register("hpcsaExpiryDate")}
                />
              </FormRow>

              <FormRow>
                <Input
                  label="SAPC number"
                  hint="Pharmacists only — leave blank otherwise"
                  error={errors.sapcNumber?.message}
                  {...register("sapcNumber")}
                />
                <Input
                  label="SAPC expiry date"
                  type="date"
                  error={errors.sapcExpiryDate?.message}
                  {...register("sapcExpiryDate")}
                />
              </FormRow>

              <div className="mt-1 flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-sunken p-4">
                <p className="text-[13px] font-semibold text-text-secondary">Emergency contact (optional)</p>
                <FormRow>
                  <Input
                    label="Contact name"
                    placeholder="Thandi Sithole"
                    error={errors.emergencyContactName?.message}
                    {...register("emergencyContactName")}
                  />
                  <Input
                    label="Relationship"
                    placeholder="Sister"
                    error={errors.emergencyContactRelationship?.message}
                    {...register("emergencyContactRelationship")}
                  />
                </FormRow>
                <Input
                  label="Contact phone"
                  icon={<Phone className="size-4" aria-hidden />}
                  placeholder="+27 83 123 4567"
                  error={errors.emergencyContactPhone?.message}
                  {...register("emergencyContactPhone")}
                />
              </div>

              <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
                Create staff account
              </Button>
            </form>
          </Card>
        )}
      </div>
  );
}
