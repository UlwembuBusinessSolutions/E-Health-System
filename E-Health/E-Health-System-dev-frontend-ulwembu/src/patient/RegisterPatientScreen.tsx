import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, CreditCard, Hash, MapPin, Phone, Plus, Trash2, User } from "lucide-react";
import { registerPatientSchema, type RegisterPatientValues } from "./validation";
import { registerPatient } from "@/shared/api/patients";
import { ApiError } from "@/shared/api/client";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";

// PREG-US-001: "Given a person is not already registered, When I complete
// the registration form with all mandatory fields, Then an EPR is created
// and a unique MPI number is generated." dateOfBirth/gender/citizenship
// aren't form fields at all — PatientController derives all three from
// idNumber alone (SouthAfricanIdNumber.parse()'s own why-note), so this
// form only ever asks for what a receptionist can actually read off an ID
// document: the number itself, not a birthdate the person has to state
// separately and that could disagree with it.
export function RegisterPatientScreen() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
  } = useForm<RegisterPatientValues>({
    resolver: zodResolver(registerPatientSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      idNumber: "",
      address: "",
      contactNumber: "",
      medicalAidProvider: "",
      medicalAidNumber: "",
      nextOfKin: [{ name: "", relationship: "", contactNumber: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "nextOfKin" });

  const mutation = useMutation({
    mutationFn: (values: RegisterPatientValues) =>
      registerPatient({
        firstName: values.firstName,
        lastName: values.lastName,
        idNumber: values.idNumber,
        address: values.address,
        contactNumber: values.contactNumber,
        medicalAidProvider: values.medicalAidProvider || undefined,
        medicalAidNumber: values.medicalAidNumber || undefined,
        nextOfKin: values.nextOfKin,
      }),
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: RegisterPatientValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Link
          to="/app/patients"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to patients
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
            <h3 className="text-[16px] font-semibold text-text-primary">Patient registered</h3>
            <p className="max-w-sm text-[14px] text-text-secondary">
              {mutation.data.firstName} {mutation.data.lastName} is now searchable across the organization.
            </p>
            <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[13px] text-text-primary">
              {mutation.data.mpiNumber}
            </p>

            <div className="mt-2 flex w-full flex-col gap-2">
              <Button size="lg" className="w-full" onClick={() => navigate(`/app/patients/${mutation.data.id}`)}>
                View patient record
              </Button>
              <Button variant="secondary" size="lg" className="w-full" onClick={() => mutation.reset()}>
                Register another patient
              </Button>
            </div>
          </motion.div>
        </Card>
      ) : (
        <Card className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-[20px] font-semibold text-text-primary">Register patient</h1>
            <p className="mt-1 text-[14px] text-text-secondary">
              A unique MPI number is generated automatically once this form is submitted.
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
                label="First name"
                required
                icon={<User className="size-4" aria-hidden />}
                placeholder="Lindiwe"
                autoComplete="given-name"
                error={errors.firstName?.message}
                {...register("firstName")}
              />
              <Input
                label="Last name"
                required
                placeholder="Mokoena"
                autoComplete="family-name"
                error={errors.lastName?.message}
                {...register("lastName")}
              />
            </FormRow>

            <Input
              label="SA ID number"
              required
              icon={<CreditCard className="size-4" aria-hidden />}
              placeholder="9005155001084"
              inputMode="numeric"
              autoComplete="off"
              hint={!errors.idNumber ? "Date of birth, gender and citizenship are derived from this." : undefined}
              error={errors.idNumber?.message}
              {...register("idNumber")}
            />

            <Input
              label="Address"
              required
              icon={<MapPin className="size-4" aria-hidden />}
              placeholder="Street, suburb, city"
              autoComplete="street-address"
              error={errors.address?.message}
              {...register("address")}
            />

            <Input
              label="Contact number"
              required
              icon={<Phone className="size-4" aria-hidden />}
              placeholder="+27 82 123 4567"
              autoComplete="tel"
              error={errors.contactNumber?.message}
              {...register("contactNumber")}
            />

            <FormRow>
              <Input
                label="Medical aid provider"
                icon={<Hash className="size-4" aria-hidden />}
                placeholder="Discovery"
                error={errors.medicalAidProvider?.message}
                {...register("medicalAidProvider")}
              />
              <Input
                label="Medical aid number"
                placeholder="DH123456"
                error={errors.medicalAidNumber?.message}
                {...register("medicalAidNumber")}
              />
            </FormRow>

            <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14.5px] font-semibold text-text-primary">Next of kin or guardian</h2>
                  <p className="mt-1 text-[13px] text-text-secondary">Add someone we can contact in an emergency.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="size-3.5" aria-hidden />}
                  onClick={() => append({ name: "", relationship: "", contactNumber: "" })}
                >
                  Add
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr_1.2fr_auto] sm:items-start">
                  <Input label="Name" required error={errors.nextOfKin?.[index]?.name?.message} {...register(`nextOfKin.${index}.name`)} />
                  <Input label="Relationship" required placeholder="Parent" error={errors.nextOfKin?.[index]?.relationship?.message} {...register(`nextOfKin.${index}.relationship`)} />
                  <Input label="Contact number" required inputMode="tel" placeholder="+27 82 123 4567" error={errors.nextOfKin?.[index]?.contactNumber?.message} {...register(`nextOfKin.${index}.contactNumber`)} />
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden />} aria-label="Remove next-of-kin" onClick={() => remove(index)} />
                  )}
                </div>
              ))}
              {typeof errors.nextOfKin?.message === "string" && <p className="text-[13px] text-danger-500">{errors.nextOfKin.message}</p>}
            </div>

            <Button type="submit" size="lg" loading={isSubmitting || mutation.isPending} className="mt-1 w-full">
              Register patient
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
