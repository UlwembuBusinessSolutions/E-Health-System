import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Hash,
  MapPin,
  Phone,
  User,
} from "lucide-react";

import {
  registerPatientSchema,
  type RegisterPatientValues,
} from "./validation";

import { registerPatient } from "@/shared/api/patients";
import { ApiError } from "@/shared/api/client";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";

import type { Gender } from "@/shared/api/types";

type CitizenshipStatus =
  | "SA_CITIZEN"
  | "PERMANENT_RESIDENT";

/**
 * Converts user-friendly citizenship values into
 * the exact values expected by the backend.
 *
 * Examples:
 * "SA Citizen"          -> "SA_CITIZEN"
 * "SA_Citizen"          -> "SA_CITIZEN"
 * "sa citizen"          -> "SA_CITIZEN"
 * "SA_CITIZEN"          -> "SA_CITIZEN"
 * "Permanent Resident"  -> "PERMANENT_RESIDENT"
 * "permanent resident"  -> "PERMANENT_RESIDENT"
 */
const normalizeCitizenshipStatus = (
  value: string | undefined,
): CitizenshipStatus | undefined => {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "SA_CITIZEN":
      return "SA_CITIZEN";

    case "PERMANENT_RESIDENT":
      return "PERMANENT_RESIDENT";

    default:
      return undefined;
  }
};

/**
 * Converts user-friendly gender values into
 * the exact values expected by the backend.
 *
 * Examples:
 * "Male"   -> "MALE"
 * "male"   -> "MALE"
 * "MALE"   -> "MALE"
 * "Female" -> "FEMALE"
 * "Other"  -> "OTHER"
 */
const normalizeGender = (
  value: string | undefined,
): Gender | undefined => {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "MALE":
      return "MALE";

    case "FEMALE":
      return "FEMALE";

    case "OTHER":
      return "OTHER";

    default:
      return undefined;
  }
};

export function RegisterPatientScreen() {
  const navigate = useNavigate();

  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterPatientValues>({
    resolver: zodResolver(registerPatientSchema),

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
    },
  });

  /**
   * Watch the identity number so that the page
   * can determine whether the receptionist entered
   * an SA ID or passport.
   */
  const identityNumber = watch("idNumber");

  const isSouthAfricanId = /^\d{13}$/.test(
    identityNumber.trim(),
  );

  const isPassport = /[A-Za-z]/.test(
    identityNumber.trim(),
  );

  const identityType = isSouthAfricanId
    ? "South African ID"
    : isPassport
      ? "Passport"
      : null;

  const mutation = useMutation({
    mutationFn: (values: RegisterPatientValues) => {
      const identity = values.idNumber.trim();

      const isId = /^\d{13}$/.test(identity);

      return registerPatient({
        firstName: values.firstName,
        lastName: values.lastName,

        idNumber: isId
          ? identity
          : undefined,

        passportNumber: isId
          ? undefined
          : identity,

        dateOfBirth: isId
          ? undefined
          : values.dateOfBirth?.trim() || undefined,

        gender: isId
          ? undefined
          : normalizeGender(values.gender),

        citizenshipStatus: isId
          ? undefined
          : normalizeCitizenshipStatus(
              values.citizenshipStatus,
            ),

        address: values.address,
        contactNumber: values.contactNumber,

        medicalAidProvider:
          values.medicalAidProvider?.trim() || undefined,

        medicalAidNumber:
          values.medicalAidNumber?.trim() || undefined,
      });
    },

    onError: (error) => {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    },
  });

  const onSubmit = (values: RegisterPatientValues) => {
    setFormError(null);
    mutation.mutate(values);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {/* Back navigation */}
      <div>
        <Link
          to="/app/patients"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft
            className="size-4"
            aria-hidden
          />

          Back to patients
        </Link>
      </div>

      {mutation.isSuccess ? (
        <Card className="p-8">
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.97,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.25,
              ease: "easeOut",
            }}
            className="flex flex-col items-center gap-3 text-center"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-success-50 text-success-500">
              <CheckCircle2
                className="size-6"
                aria-hidden
              />
            </span>

            <h3 className="text-[16px] font-semibold text-text-primary">
              Patient registered
            </h3>

            <p className="max-w-sm text-[14px] text-text-secondary">
              {mutation.data.firstName}{" "}
              {mutation.data.lastName} is now searchable
              across the organization.
            </p>

            <p className="rounded-lg bg-surface-sunken px-3 py-1.5 font-mono text-[13px] text-text-primary">
              {mutation.data.mpiNumber}
            </p>

            <div className="mt-2 flex w-full flex-col gap-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() =>
                  navigate(
                    `/app/patients/${mutation.data.id}`,
                  )
                }
              >
                View patient record
              </Button>

              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => mutation.reset()}
              >
                Register another patient
              </Button>
            </div>
          </motion.div>
        </Card>
      ) : (


        <Card className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-[20px] font-semibold text-text-primary">
              Register patient
            </h1>

            <p className="mt-1 text-[14px] text-text-secondary">
              A unique MPI number is generated automatically
              once this form is submitted.
            </p>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
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
                icon={
                  <User
                    className="size-4"
                    aria-hidden
                  />
                }
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
              label="ID number / Passport number"
              required
              icon={
                <CreditCard
                  className="size-4"
                  aria-hidden
                />
              }
              placeholder="9005155001084 or A1234567"
              autoComplete="off"
              error={errors.idNumber?.message}
              hint={
                !errors.idNumber
                  ? identityType
                    ? `Detected: ${identityType}`
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
                  hint="You can enter Male, Female or Other."
                  error={errors.gender?.message}
                  {...register("gender")}
                />

                <Input
                  label="Citizenship status"
                  required
                  placeholder="SA Citizen or Permanent Resident"
                  hint="You can enter SA Citizen or Permanent Resident."
                  error={
                    errors.citizenshipStatus?.message
                  }
                  {...register("citizenshipStatus")}
                />
              </>
            )}

            <Input
              label="Address"
              required
              icon={
                <MapPin
                  className="size-4"
                  aria-hidden
                />
              }
              placeholder="Street, suburb, city"
              autoComplete="street-address"
              error={errors.address?.message}
              {...register("address")}
            />

            <Input
              label="Contact number"
              required
              icon={
                <Phone
                  className="size-4"
                  aria-hidden
                />
              }
              placeholder="+27 82 123 4567"
              autoComplete="tel"
              error={errors.contactNumber?.message}
              {...register("contactNumber")}
            />

            <FormRow>
              <Input
                label="Medical aid provider"
                icon={
                  <Hash
                    className="size-4"
                    aria-hidden
                  />
                }
                placeholder="Discovery"
                error={
                  errors.medicalAidProvider?.message
                }
                {...register("medicalAidProvider")}
              />

              <Input
                label="Medical aid number"
                placeholder="DH123456"
                error={
                  errors.medicalAidNumber?.message
                }
                {...register("medicalAidNumber")}
              />
            </FormRow>

            <Button
              type="submit"
              size="lg"
              loading={
                isSubmitting || mutation.isPending
              }
              className="mt-1 w-full"
            >
              Register patient
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}