import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Hash, MapPin, Phone, User } from "lucide-react";

//import { useAuth } from "@/auth/AuthContext";

import {
  editPatientSchema,
  CLINICALLY_SIGNIFICANT_FIELDS,
  type EditPatientValues,
} from "./validation";
import { getPatient, updatePatient } from "@/shared/api/patients";
import { ApiError } from "@/shared/api/client";
import type { Gender } from "@/shared/api/types";

import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";
import { useToast } from "@/shared/components/toast/ToastProvider";

type CitizenshipStatus = "SA_CITIZEN" | "PERMANENT_RESIDENT";

const normalizeCitizenshipStatus = (value: string | undefined): CitizenshipStatus | undefined => {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return normalized === "SA_CITIZEN" || normalized === "PERMANENT_RESIDENT" ? normalized : undefined;
};

const normalizeGender = (value: string | undefined): Gender | undefined => {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized === "MALE" || normalized === "FEMALE" || normalized === "OTHER" ? normalized : undefined;
};


export function EditPatientScreen() {
  const { id } = useParams<{ id: string }>();
  const patientId = id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  // const { user } = useAuth();

  // const canEditPage =
  //   user?.role === "ORG_ADMIN" || user?.role === "Admin Staff" || user?.role === "Queue Marshall";

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => getPatient(patientId),
    enabled: !!patientId,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditPatientValues>({
    resolver: zodResolver(editPatientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      idNumber: "",
      dateOfBirth: "",
      gender: "",
      citizenshipStatus: "",
      address: "",
      contactNumber: "",
      medicalAidProvider: "",
      medicalAidNumber: "",
      reasonForChange: "",
    },
  });


  const [original, setOriginal] = useState<EditPatientValues | null>(null);
  useEffect(() => {
    const patient = patientQuery.data;
    if (!patient) return;
    const values: EditPatientValues = {
      firstName: patient.firstName,
      lastName: patient.lastName,
      idNumber: patient.idNumber ?? patient.passportNumber ?? "",
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      citizenshipStatus: patient.citizenshipStatus,
      address: patient.address,
      contactNumber: patient.contactNumber,
      medicalAidProvider: patient.medicalAidProvider ?? "",
      medicalAidNumber: patient.medicalAidNumber ?? "",
      reasonForChange: "",
    };
    reset(values);
    setOriginal(values);
  }, [patientQuery.data, reset]);

  const identityNumber = watch("idNumber");
  const isSouthAfricanId = /^\d{13}$/.test((identityNumber ?? "").trim());
  const isPassport = /[A-Za-z]/.test((identityNumber ?? "").trim());
  const identityType = isSouthAfricanId ? "South African ID" : isPassport ? "Passport" : null;

  const reasonForChange = watch("reasonForChange");

  const changedSignificantFields = useMemo(() => {
    if (!original) return [];
    const current = watch();
    return CLINICALLY_SIGNIFICANT_FIELDS.filter((field) => (current[field] ?? "") !== (original[field] ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, watch("idNumber"), watch("dateOfBirth"), watch("gender"), watch("citizenshipStatus")]);

  const reasonRequired = changedSignificantFields.length > 0;

  const mutation = useMutation({
    mutationFn: (values: EditPatientValues) => {
      const identity = values.idNumber.trim();
      const isId = /^\d{13}$/.test(identity);
      return updatePatient(patientId, {
        firstName: values.firstName,
        lastName: values.lastName,
        idNumber: isId ? identity : undefined,
        passportNumber: isId ? undefined : identity,
        dateOfBirth: isId ? undefined : values.dateOfBirth?.trim() || undefined,
        gender: isId ? undefined : normalizeGender(values.gender),
        citizenshipStatus: isId ? undefined : normalizeCitizenshipStatus(values.citizenshipStatus),
        address: values.address,
        contactNumber: values.contactNumber,
        medicalAidProvider: values.medicalAidProvider?.trim() || undefined,
        medicalAidNumber: values.medicalAidNumber?.trim() || undefined,
        reasonForChange: values.reasonForChange?.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients", patientId] });
      showToast("Patient record updated.", "success");
      navigate(`/app/patients/${patientId}`);
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: EditPatientValues) => {
    setFormError(null);
    if (reasonRequired && !values.reasonForChange?.trim()) {
      setError("reasonForChange", {
        type: "manual",
        message: "A reason is required when identity or demographic details change.",
      });
      return;
    }
    mutation.mutate(values);
  };

  useEffect(() => {
    if (patientQuery.data?.deceased) 
    {
      navigate(`/app/patients/${patientId}`, { replace: true });
    }
  }, [patientQuery.data, patientId, navigate]);

  const patient = patientQuery.data;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        to={patientId ? `/app/patients/${patientId}` : "/app/patients"}
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to patient
      </Link>

      {patientQuery.isLoading ? (
        <p className="text-[14px] text-text-secondary">Loading…</p>
      ) : !patient ? (
        <p className="text-[14px] text-text-secondary">This patient couldn't be found.</p>
      ) : (
        <Card className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-[20px] font-semibold text-text-primary">Edit patient</h1>
            <p className="mt-1 text-[14px] text-text-secondary">
              Update {patient.firstName} {patient.lastName}'s contact and demographic details.
            </p>
          </div>

          {/* MPI is display-only — never a registered field, never submitted.
              AC2: not editable by any role. */}
          <div className="mb-5 flex items-center justify-between rounded-lg border border-border-subtle bg-surface-sunken px-3.5 py-2.5">
            <span className="text-[13px] text-text-secondary">MPI number</span>
            <span className="font-mono text-[13px] font-semibold text-text-primary">{patient.mpiNumber}</span>
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
              label="ID number / Passport number"
              required
              icon={<CreditCard className="size-4" aria-hidden />}
              autoComplete="off"
              error={errors.idNumber?.message}
              hint={
                !errors.idNumber
                  ? identityType
                    ? `Detected: ${identityType} · changing this requires a reason below`
                    : "Enter a South African ID number or passport number."
                  : undefined
              }
              {...register("idNumber")}
            />

            {identityType === "Passport" && (
              <>
                <Input
                  label="Date of birth"
                  required
                  type="date"
                  error={errors.dateOfBirth?.message}
                  {...register("dateOfBirth")}
                />
                <Input
                  label="Gender"
                  required
                  placeholder="Male, Female or Other"
                  error={errors.gender?.message}
                  {...register("gender")}
                />
                <Input
                  label="Citizenship status"
                  required
                  placeholder="SA Citizen or Permanent Resident"
                  error={errors.citizenshipStatus?.message}
                  {...register("citizenshipStatus")}
                />
              </>
            )}

            <Input
              label="Address"
              required
              icon={<MapPin className="size-4" aria-hidden />}
              autoComplete="street-address"
              error={errors.address?.message}
              {...register("address")}
            />

            <Input
              label="Contact number"
              required
              icon={<Phone className="size-4" aria-hidden />}
              autoComplete="tel"
              error={errors.contactNumber?.message}
              {...register("contactNumber")}
            />

            <FormRow>
              <Input
                label="Medical aid provider"
                icon={<Hash className="size-4" aria-hidden />}
                error={errors.medicalAidProvider?.message}
                {...register("medicalAidProvider")}
              />
              <Input
                label="Medical aid number"
                error={errors.medicalAidNumber?.message}
                {...register("medicalAidNumber")}
              />
            </FormRow>

            {reasonRequired && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="reasonForChange" className="text-[13px] font-medium text-text-primary">
                  Reason for change <span className="text-danger-500">*</span>
                </label>
                <textarea
                  id="reasonForChange"
                  rows={3}
                  className="w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[15px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  placeholder="e.g. Correcting a data-entry error from initial registration"
                  {...register("reasonForChange")}
                />
                <p className="text-[13px] text-text-secondary">
                  Required because you changed: {changedSignificantFields.join(", ")}.
                </p>
                {errors.reasonForChange && (
                  <p className="text-[13px] text-danger-500">{errors.reasonForChange.message}</p>
                )}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting || mutation.isPending}
              disabled={!isDirty && changedSignificantFields.length === 0}
              className="mt-1 w-full"
            >
              Save changes
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}