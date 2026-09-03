import { useRef, useState, type ComponentType } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import clsx from "clsx";
import {
  AlertCircle,
  ArrowLeft,
  BookUser,
  CheckCircle2,
  CreditCard,
  FileText,
  Hash,
  HeartPulse,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { registerPatientSchema, type RegisterPatientValues } from "./validation";
import {
  addGuardian,
  registerPatient,
  uploadGuardianSignature,
  uploadPatientDocument,
  validateDocumentFile,
  type GuardianRelationship,
  type Patient,
  type PatientDocumentType,
} from "@/shared/api/patients";
import { ApiError } from "@/shared/api/client";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";
import { Select } from "@/shared/components/Select";
import { Switch } from "@/shared/components/Switch";
import { SignaturePad } from "@/shared/components/SignaturePad";

const MAX_GUARDIANS = 5;

const RELATIONSHIP_OPTIONS: { value: GuardianRelationship; label: string }[] = [
  { value: "PARENT", label: "Parent" },
  { value: "LEGAL_GUARDIAN", label: "Legal guardian" },
  { value: "GRANDPARENT", label: "Grandparent" },
  { value: "SIBLING", label: "Sibling" },
  { value: "OTHER", label: "Other" },
];

interface StagedGuardian {
  key: string;
  firstName: string;
  lastName: string;
  relationship: GuardianRelationship | "";
  contactNumber: string;
  idNumber: string;
  email: string;
  signature: Blob | null;
}

function emptyGuardian(): StagedGuardian {
  return {
    key: crypto.randomUUID(),
    firstName: "",
    lastName: "",
    relationship: "",
    contactNumber: "",
    idNumber: "",
    email: "",
    signature: null,
  };
}

// A row is "started" once anything's been typed into it — an untouched row
// (the one every toggle-on begins with) is skipped by validation rather
// than demanding required fields on a guardian nobody meant to add yet.
function isGuardianStarted(g: StagedGuardian): boolean {
  return !!(g.firstName || g.lastName || g.relationship || g.contactNumber || g.idNumber || g.email);
}

function validateGuardians(list: StagedGuardian[]): string | null {
  for (const g of list) {
    if (!isGuardianStarted(g)) continue;
    if (!g.firstName.trim() || !g.lastName.trim() || !g.relationship || !g.contactNumber.trim()) {
      return "Each guardian needs a first name, last name, relationship, and contact number.";
    }
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(type: string): ComponentType<{ className?: string; "aria-hidden"?: boolean }> {
  return type.startsWith("image/") ? ImageIcon : FileText;
}

// Stages a file locally (nothing uploads yet — the patient this would
// attach to doesn't exist until the form actually submits), as a dropzone
// that turns into a compact filled row once a file lands — same visual
// language as PatientDetailPage's own Documents card, just without a
// "View" (there's nothing uploaded to view yet) or upload progress (that
// only starts after the patient itself is created, in RegisterPatientScreen's
// own mutation.onSuccess).
function DocumentPickerField({
  label,
  icon: LabelIcon,
  file,
  onChange,
}: {
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = () => inputRef.current?.click();
  const FileIcon = file ? fileTypeIcon(file.type) : null;

  // Same checks PatientDocumentService.upload() and the global multipart
  // limit enforce server-side — validateDocumentFile()'s own why-note on
  // why this doesn't replace that, just catches the same rejection before
  // a round trip (and, unlike the <input accept>, actually covers a
  // dropped file too).
  const pick = (candidate: File) => {
    const message = validateDocumentFile(candidate);
    setError(message);
    if (!message) onChange(candidate);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[13px] font-medium text-text-primary">
        <LabelIcon className="size-3.5 text-text-secondary" aria-hidden />
        {label}
      </span>
      {file && FileIcon ? (
        <div className="flex h-11 items-center justify-between gap-2 rounded-lg border border-border-strong bg-surface-raised px-3.5">
          <span className="flex min-w-0 items-center gap-2 text-[13.5px] text-text-primary">
            <FileIcon className="size-4 shrink-0 text-text-secondary" aria-hidden />
            <span className="truncate">{file.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            <span className="text-[12px] text-text-secondary">{formatFileSize(file.size)}</span>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setError(null);
              }}
              aria-label={`Remove ${label.toLowerCase()}`}
              className="text-text-secondary transition-colors duration-150 hover:text-danger-600"
            >
              <X className="size-4" aria-hidden />
            </button>
          </span>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") open();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) pick(dropped);
          }}
          className={clsx(
            "flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed px-3.5 text-[13px] transition-colors duration-150",
            isDragOver
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : error
                ? "border-danger-500/50 bg-danger-50 text-danger-600"
                : "border-border-strong bg-surface-sunken/60 text-text-secondary hover:bg-surface-sunken",
          )}
        >
          <Upload className="size-4 shrink-0" aria-hidden />
          Drop file, or <span className="font-medium text-brand-600">browse</span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-[12px] text-danger-600">
          {error}
        </p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="sr-only"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (selected) pick(selected);
        }}
      />
    </div>
  );
}

// One repeatable entry — RegisterPatientScreen renders one per staged
// guardian, up to MAX_GUARDIANS. The signature is entirely optional and
// entirely local until the patient (and then this guardian) actually
// exists server-side; see mutation.onSuccess below for when it uploads.
function GuardianEntry({
  index,
  guardian,
  onUpdate,
  onRemove,
  canRemove,
}: {
  index: number;
  guardian: StagedGuardian;
  onUpdate: (patch: Partial<StagedGuardian>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-strong p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-text-primary">Guardian {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove guardian ${index + 1}`}
            className="text-text-secondary transition-colors duration-150 hover:text-danger-600"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <FormRow>
        <Input
          label="First name"
          required
          placeholder="Sipho"
          value={guardian.firstName}
          onChange={(e) => onUpdate({ firstName: e.target.value })}
        />
        <Input
          label="Last name"
          required
          placeholder="Dlamini"
          value={guardian.lastName}
          onChange={(e) => onUpdate({ lastName: e.target.value })}
        />
      </FormRow>

      <FormRow>
        <Select
          label="Relationship to patient"
          required
          options={RELATIONSHIP_OPTIONS}
          value={guardian.relationship}
          onChange={(e) => onUpdate({ relationship: e.target.value as GuardianRelationship })}
        />
        <Input
          label="Contact number"
          required
          placeholder="+27 82 123 4567"
          value={guardian.contactNumber}
          onChange={(e) => onUpdate({ contactNumber: e.target.value })}
        />
      </FormRow>

      <FormRow>
        <Input
          label="ID number"
          placeholder="Optional"
          inputMode="numeric"
          value={guardian.idNumber}
          onChange={(e) => onUpdate({ idNumber: e.target.value })}
        />
        <Input
          label="Email"
          type="email"
          placeholder="Optional"
          value={guardian.email}
          onChange={(e) => onUpdate({ email: e.target.value })}
        />
      </FormRow>

      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-text-primary">
          Consent to act on the patient's behalf <span className="font-normal text-text-secondary">(optional)</span>
        </span>
        <SignaturePad onChange={(signature) => onUpdate({ signature })} />
      </div>
    </div>
  );
}

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
  const [idCopyFile, setIdCopyFile] = useState<File | null>(null);
  const [medicalAidCardFile, setMedicalAidCardFile] = useState<File | null>(null);
  const [documentUploadStatus, setDocumentUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [documentUploadError, setDocumentUploadError] = useState<string | null>(null);
  const [guardiansEnabled, setGuardiansEnabled] = useState(false);
  const [guardians, setGuardians] = useState<StagedGuardian[]>([]);
  const [guardianUploadStatus, setGuardianUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [guardianUploadError, setGuardianUploadError] = useState<string | null>(null);

  const toggleGuardians = (enabled: boolean) => {
    setGuardiansEnabled(enabled);
    if (enabled && guardians.length === 0) setGuardians([emptyGuardian()]);
  };

  const updateGuardian = (key: string, patch: Partial<StagedGuardian>) => {
    setGuardians((list) => list.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
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
      passportNumber: "",
      passportExpiry: "",
    },
  });

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
        passportNumber: values.passportNumber || undefined,
        passportExpiry: values.passportExpiry || undefined,
      }),
    onSuccess: (patient: Patient) => {
      const staged: { documentType: PatientDocumentType; file: File }[] = [];
      if (idCopyFile) staged.push({ documentType: "ID_COPY", file: idCopyFile });
      if (medicalAidCardFile) staged.push({ documentType: "MEDICAL_AID_CARD", file: medicalAidCardFile });
      if (staged.length > 0) {
        // Best-effort, after the patient itself already exists — a document
        // upload failure here shouldn't read as "registration failed," since
        // it didn't; the success screen below surfaces this separately and
        // points at the patient record, where the same upload is always
        // retryable (PatientDetailPage's own Documents card).
        setDocumentUploadStatus("uploading");
        (async () => {
          try {
            for (const { documentType, file } of staged) {
              await uploadPatientDocument(patient.id, documentType, file);
            }
            setDocumentUploadStatus("done");
          } catch (error) {
            setDocumentUploadStatus("error");
            setDocumentUploadError(
              error instanceof ApiError ? error.message : "Couldn't upload one or more documents.",
            );
          }
        })();
      }

      const startedGuardians = guardiansEnabled ? guardians.filter(isGuardianStarted) : [];
      if (startedGuardians.length > 0) {
        // Same best-effort shape as the documents above — each guardian is
        // its own record, then its own optional signature upload, so one
        // guardian's failure doesn't stop the rest from being created.
        setGuardianUploadStatus("uploading");
        (async () => {
          try {
            for (const g of startedGuardians) {
              const created = await addGuardian(patient.id, {
                firstName: g.firstName,
                lastName: g.lastName,
                relationship: g.relationship as GuardianRelationship,
                contactNumber: g.contactNumber,
                idNumber: g.idNumber || undefined,
                email: g.email || undefined,
              });
              if (g.signature) await uploadGuardianSignature(patient.id, created.id, g.signature);
            }
            setGuardianUploadStatus("done");
          } catch (error) {
            setGuardianUploadStatus("error");
            setGuardianUploadError(
              error instanceof ApiError ? error.message : "Couldn't save one or more guardians.",
            );
          }
        })();
      }
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (values: RegisterPatientValues) => {
    setFormError(null);
    if (guardiansEnabled) {
      const message = validateGuardians(guardians);
      if (message) {
        setFormError(message);
        return;
      }
    }
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

            {documentUploadStatus === "uploading" && (
              <p className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Uploading attached documents…
              </p>
            )}
            {documentUploadStatus === "done" && (
              <p className="flex items-center gap-1.5 text-[13px] text-success-600">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Documents attached.
              </p>
            )}
            {documentUploadStatus === "error" && (
              <p className="flex items-center gap-1.5 text-[13px] text-danger-600">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                {documentUploadError} You can retry from the patient's record.
              </p>
            )}

            {guardianUploadStatus === "uploading" && (
              <p className="flex items-center gap-1.5 text-[13px] text-text-secondary">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                Saving guardians…
              </p>
            )}
            {guardianUploadStatus === "done" && (
              <p className="flex items-center gap-1.5 text-[13px] text-success-600">
                <CheckCircle2 className="size-3.5" aria-hidden />
                Guardians saved.
              </p>
            )}
            {guardianUploadStatus === "error" && (
              <p className="flex items-center gap-1.5 text-[13px] text-danger-600">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                {guardianUploadError} You can retry from the patient's record.
              </p>
            )}

            <div className="mt-2 flex w-full flex-col gap-2">
              <Button size="lg" className="w-full" onClick={() => navigate(`/app/patients/${mutation.data.id}`)}>
                View patient record
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => {
                  mutation.reset();
                  setIdCopyFile(null);
                  setMedicalAidCardFile(null);
                  setDocumentUploadStatus("idle");
                  setDocumentUploadError(null);
                  setGuardiansEnabled(false);
                  setGuardians([]);
                  setGuardianUploadStatus("idle");
                  setGuardianUploadError(null);
                }}
              >
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

            <FormRow>
              <Input
                label="Passport number"
                icon={<BookUser className="size-4" aria-hidden />}
                placeholder="Optional"
                autoComplete="off"
                hint="If this patient also holds a passport."
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

            <div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border-strong px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-text-secondary" aria-hidden />
                  <div>
                    <p className="text-[13.5px] font-medium text-text-primary">Travelling with a guardian?</p>
                    <p className="text-[12.5px] text-text-secondary">
                      For a minor, or anyone who may need to be reached on the patient's behalf.
                    </p>
                  </div>
                </div>
                <Switch checked={guardiansEnabled} onChange={toggleGuardians} label="Travelling with a guardian" />
              </div>

              {guardiansEnabled && (
                <div className="mt-3 flex flex-col gap-3">
                  {guardians.map((guardian, index) => (
                    <GuardianEntry
                      key={guardian.key}
                      index={index}
                      guardian={guardian}
                      onUpdate={(patch) => updateGuardian(guardian.key, patch)}
                      onRemove={() => setGuardians((list) => list.filter((g) => g.key !== guardian.key))}
                      canRemove={guardians.length > 1}
                    />
                  ))}
                  {guardians.length < MAX_GUARDIANS && (
                    <button
                      type="button"
                      onClick={() => setGuardians((list) => [...list, emptyGuardian()])}
                      className="inline-flex w-fit items-center gap-1.5 text-[13px] font-medium text-brand-600 hover:text-brand-700"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Add another guardian
                    </button>
                  )}
                </div>
              )}
            </div>

            <div>
              <p className="text-[13px] font-medium text-text-primary">Documents</p>
              <p className="mb-2 text-[12.5px] text-text-secondary">
                Optional — attach a scan or photo now, or add these later from the patient's record.
              </p>
              <FormRow>
                <DocumentPickerField label="ID copy" icon={CreditCard} file={idCopyFile} onChange={setIdCopyFile} />
                <DocumentPickerField
                  label="Medical aid card"
                  icon={HeartPulse}
                  file={medicalAidCardFile}
                  onChange={setMedicalAidCardFile}
                />
              </FormRow>
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
