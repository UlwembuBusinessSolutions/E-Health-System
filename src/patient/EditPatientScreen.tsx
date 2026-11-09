import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Hash, MapPin, Phone, User } from "lucide-react";
import { z } from "zod";
import { getPatient, updatePatient } from "@/shared/api/patients";
import { ApiError } from "@/shared/api/client";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";
import { useToast } from "@/shared/components/toast/ToastProvider";

const editPatientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  address: z.string().trim().min(1, "Address is required").max(500),
  contactNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{9,15}$/, "Enter a valid contact number, e.g. +27821234567"),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  medicalAidProvider: z.string().trim().max(100),
  medicalAidNumber: z.string().trim().max(50),
  passportNumber: z.string().trim().max(20),
  passportExpiry: z.string().trim(),
  reason: z.string().trim().min(1, "A reason for the change is required").max(500),
});

type EditPatientValues = z.infer<typeof editPatientSchema>;

export function EditPatientScreen() {
  const { id } = useParams<{ id: string }>();
  const patientId = id ?? "";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const patientQuery = useQuery({
    queryKey: ["patients", patientId],
    queryFn: () => getPatient(patientId),
    enabled: !!patientId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditPatientValues>({
    resolver: zodResolver(editPatientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      address: "",
      contactNumber: "",
      email: "",
      medicalAidProvider: "",
      medicalAidNumber: "",
      passportNumber: "",
      passportExpiry: "",
      reason: "",
    },
  });

  useEffect(() => {
    const patient = patientQuery.data;
    if (!patient) return;
    reset({
      firstName: patient.firstName,
      lastName: patient.lastName,
      address: patient.address,
      contactNumber: patient.contactNumber,
      email: patient.email ?? "",
      medicalAidProvider: patient.medicalAidProvider ?? "",
      medicalAidNumber: patient.medicalAidNumber ?? "",
      passportNumber: patient.passportNumber ?? "",
      passportExpiry: patient.passportExpiry ?? "",
      reason: "",
    });
  }, [patientQuery.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: EditPatientValues) =>
      updatePatient(patientId, {
        firstName: values.firstName,
        lastName: values.lastName,
        address: values.address,
        contactNumber: values.contactNumber,
        email: values.email?.trim() || undefined,
        medicalAidProvider: values.medicalAidProvider.trim() || undefined,
        medicalAidNumber: values.medicalAidNumber.trim() || undefined,
        passportNumber: values.passportNumber.trim() || undefined,
        passportExpiry: values.passportExpiry.trim() || undefined,
        reason: values.reason,
      }),
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
    mutation.mutate(values);
  };

  useEffect(() => {
    const patient = patientQuery.data;
    if (patient && (patient.archived || patient.deceasedDate)) {
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
              Update {patient.firstName} {patient.lastName}'s contact and record details.
            </p>
            <p className="mt-1 text-[13px] text-text-secondary">
              ID number, date of birth, gender, citizenship, and MPI are not editable.
            </p>
          </div>

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
              label="Address"
              required
              icon={<MapPin className="size-4" aria-hidden />}
              autoComplete="street-address"
              error={errors.address?.message}
              {...register("address")}
            />

            <FormRow>
              <Input
                label="Contact number"
                required
                icon={<Phone className="size-4" aria-hidden />}
                autoComplete="tel"
                error={errors.contactNumber?.message}
                {...register("contactNumber")}
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                error={errors.email?.message}
                {...register("email")}
              />
            </FormRow>

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

            <FormRow>
              <Input
                label="Passport number"
                icon={<CreditCard className="size-4" aria-hidden />}
                autoComplete="off"
                error={errors.passportNumber?.message}
                {...register("passportNumber")}
              />
              <Input
                label="Passport expiry"
                type="date"
                error={errors.passportExpiry?.message}
                {...register("passportExpiry")}
              />
            </FormRow>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="reason" className="text-[13px] font-medium text-text-primary">
                Reason for change <span className="text-danger-500">*</span>
              </label>
              <textarea
                id="reason"
                rows={3}
                aria-invalid={!!errors.reason}
                className="w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[15px] text-text-primary outline-none transition-colors duration-150 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                placeholder="Why is this patient record being updated?"
                {...register("reason")}
              />
              {errors.reason && <p className="text-[13px] text-danger-500">{errors.reason.message}</p>}
            </div>

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting || mutation.isPending}
              disabled={!isDirty}
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
