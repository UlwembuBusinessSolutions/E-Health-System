import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  Paperclip,
  Phone,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { editStaffSchema, type EditStaffValues } from "./validation";
import {
  deleteStaffDocument,
  getStaffDetail,
  getStaffDocumentDownloadUrl,
  listStaffDocuments,
  STAFF_DOCUMENT_TYPE_OPTIONS,
  updateStaffDetails,
  uploadStaffDocument,
  uploadStaffPhoto,
  validateStaffDocumentFile,
  type StaffDocumentType,
} from "@/shared/api/staff";
import { ApiError } from "@/shared/api/client";
import { Input } from "@/shared/components/Input";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { FormRow } from "@/shared/components/FormRow";

// Same "bytes -> KB/MB" and "ISO -> relative day" formatting as
// PatientDetailPage's own document card — kept as its own small copy here
// rather than importing from an unrelated feature module (patients.ts's own
// staff.ts precedent, see validateStaffDocumentFile's why-note).
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

// The "correct this person's details" screen — StaffController.
// UpdateStaffDetailsRequest's own why-note on exactly what this covers and
// deliberately doesn't (no employee number/email/facility/role/employment
// type/password — each of those has its own dedicated action already).
export function EditStaffScreen() {
  const { staffId } = useParams<{ staffId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const staffQuery = useQuery({
    queryKey: ["staff", staffId],
    queryFn: () => getStaffDetail(staffId ?? ""),
    enabled: !!staffId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditStaffValues>({
    resolver: zodResolver(editStaffSchema),
    defaultValues: {
      firstName: "", lastName: "", contactNumber: "", idNumber: "", dateOfBirth: "", department: "",
      designation: "", sancNumber: "", sancExpiryDate: "", hpcsaNumber: "", hpcsaExpiryDate: "", sapcNumber: "",
      sapcExpiryDate: "", emergencyContactName: "", emergencyContactRelationship: "", emergencyContactPhone: "",
    },
  });

  // Populated once the current details load — same "don't clobber a draft
  // in progress" guard as EmailSettingsSection's own effect elsewhere.
  useEffect(() => {
    if (!staffQuery.data || isDirty) return;
    const d = staffQuery.data;
    reset({
      firstName: d.firstName,
      lastName: d.lastName,
      contactNumber: d.contactNumber,
      idNumber: d.idNumber ?? "",
      dateOfBirth: d.dateOfBirth ?? "",
      department: d.department ?? "",
      designation: d.designation ?? "",
      sancNumber: d.sancNumber ?? "",
      sancExpiryDate: d.sancExpiryDate ?? "",
      hpcsaNumber: d.hpcsaNumber ?? "",
      hpcsaExpiryDate: d.hpcsaExpiryDate ?? "",
      sapcNumber: d.sapcNumber ?? "",
      sapcExpiryDate: d.sapcExpiryDate ?? "",
      emergencyContactName: d.emergencyContactName ?? "",
      emergencyContactRelationship: d.emergencyContactRelationship ?? "",
      emergencyContactPhone: d.emergencyContactPhone ?? "",
    });
  }, [staffQuery.data, isDirty, reset]);

  const mutation = useMutation({
    mutationFn: (values: EditStaffValues) =>
      updateStaffDetails(staffId ?? "", {
        firstName: values.firstName,
        lastName: values.lastName,
        contactNumber: values.contactNumber,
        idNumber: values.idNumber || undefined,
        dateOfBirth: values.dateOfBirth || undefined,
        department: values.department || undefined,
        designation: values.designation || undefined,
        sancNumber: values.sancNumber || undefined,
        sancExpiryDate: values.sancExpiryDate || undefined,
        hpcsaNumber: values.hpcsaNumber || undefined,
        hpcsaExpiryDate: values.hpcsaExpiryDate || undefined,
        sapcNumber: values.sapcNumber || undefined,
        sapcExpiryDate: values.sapcExpiryDate || undefined,
        emergencyContactName: values.emergencyContactName || undefined,
        emergencyContactRelationship: values.emergencyContactRelationship || undefined,
        emergencyContactPhone: values.emergencyContactPhone || undefined,
      }),
    onSuccess: (_result, values) => {
      setSaved(true);
      // reset(values) clears react-hook-form's isDirty flag back to false —
      // without it, isDirty stays true forever after a successful save
      // (RHF only clears it on an explicit reset, never just because a
      // submit succeeded), which meant the "Details saved." banner below
      // (gated on `saved && !isDirty`) could never actually show. Found by
      // real browser testing, not by reading the code.
      reset(values);
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : "Couldn't save those changes. Try again.");
    },
  });

  const onSubmit = (values: EditStaffValues) => {
    setFormError(null);
    setSaved(false);
    mutation.mutate(values);
  };

  // A separate mutation from the details form, on purpose — a photo has
  // its own dedicated endpoint (StaffPhotoService's deterministic S3 key)
  // and uploads the instant a file is picked, same "no separate step" UX
  // as AddStaffScreen's own create-time photo capture, just re-triggerable
  // any time afterward instead of once at creation (StaffController.
  // uploadPhoto()'s own why-note: "a second upload replaces the first").
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoMutation = useMutation({
    mutationFn: (file: File) => uploadStaffPhoto(staffId ?? "", file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staffId] });
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) photoMutation.mutate(file);
  };

  // Qualification certificates, professional registration proof, ID copies,
  // contracts and other HR paperwork — StaffDocumentService's own staff-side
  // counterpart to PatientDocumentsCard, simplified: one flat list rather
  // than per-type history panels, but with delete since the backend (unlike
  // patient documents) actually supports it.
  const [documentType, setDocumentType] = useState<StaffDocumentType>("QUALIFICATION_CERTIFICATE");
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const documentsQuery = useQuery({
    queryKey: ["staff", staffId, "documents"],
    queryFn: () => listStaffDocuments(staffId ?? ""),
    enabled: !!staffId,
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: (file: File) => uploadStaffDocument(staffId ?? "", documentType, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", staffId, "documents"] });
    },
    onError: (error) => {
      setDocumentError(error instanceof ApiError ? error.message : "Couldn't upload that document. Try again.");
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => deleteStaffDocument(staffId ?? "", documentId),
    onSuccess: () => {
      setConfirmDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["staff", staffId, "documents"] });
    },
    onError: (error) => {
      setDocumentError(error instanceof ApiError ? error.message : "Couldn't remove that document. Try again.");
    },
  });

  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateStaffDocumentFile(file);
    if (validationError) {
      setDocumentError(validationError);
      return;
    }
    setDocumentError(null);
    uploadDocumentMutation.mutate(file);
  };

  // Open a blank tab synchronously on click (so it isn't flagged as an
  // unrequested popup), then navigate it once the presigned URL comes back
  // — same sequencing PatientDocumentsCard.handleView() uses for the same
  // reason.
  const handleViewDocument = (documentId: string) => {
    const tab = window.open("", "_blank");
    getStaffDocumentDownloadUrl(staffId ?? "", documentId)
      .then((url) => {
        if (tab) tab.location.href = url;
      })
      .catch(() => {
        tab?.close();
        setDocumentError("Couldn't open that document. Try again.");
      });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        to="/app/staff"
        className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to staff
      </Link>

      <Card className="p-6 sm:p-8">
        {staffQuery.isLoading ? (
          <p className="text-[14px] text-text-secondary">Loading…</p>
        ) : staffQuery.isError || !staffQuery.data ? (
          <div className="flex flex-col items-start gap-3 text-[14px] text-text-secondary">
            <p>This staff member couldn't be loaded.</p>
            <Button variant="secondary" loading={staffQuery.isFetching} onClick={() => void staffQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[20px] font-semibold text-text-primary">Edit staff details</h1>
                <p className="mt-1 text-[14px] text-text-secondary">
                  {staffQuery.data.employeeNumber} · {staffQuery.data.email}
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <label
                  htmlFor="edit-staff-photo-input"
                  className="flex size-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong bg-surface-sunken text-text-secondary transition-colors duration-150 hover:border-brand-400 hover:text-brand-600"
                >
                  {photoMutation.isPending ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden />
                  ) : photoMutation.data?.profilePhotoUrl || staffQuery.data.profilePhotoUrl ? (
                    <img
                      src={photoMutation.data?.profilePhotoUrl ?? staffQuery.data.profilePhotoUrl ?? undefined}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <UserIcon className="size-6" aria-hidden />
                  )}
                  <input
                    ref={photoInputRef}
                    id="edit-staff-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handlePhotoChange}
                  />
                </label>
                <span className="flex items-center gap-1 text-[11.5px] font-medium text-text-secondary">
                  <Camera className="size-3" aria-hidden />
                  {staffQuery.data.profilePhotoUrl || photoMutation.data ? "Replace" : "Upload"}
                </span>
              </div>
            </div>
            {photoMutation.isError && (
              <p role="alert" className="mb-4 text-[13px] text-danger-600">
                {photoMutation.error instanceof ApiError ? photoMutation.error.message : "Couldn't upload that photo. Try again."}
              </p>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
              {formError && (
                <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
                  {formError}
                </div>
              )}
              {saved && !isDirty && (
                <div role="status" className="flex items-center gap-2 rounded-lg border border-success-500/30 bg-success-50 px-3.5 py-2.5 text-[13.5px] text-success-600">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  Details saved.
                </div>
              )}

              <FormRow>
                <Input label="First name" required autoComplete="given-name" error={errors.firstName?.message} {...register("firstName")} />
                <Input label="Last name" required autoComplete="family-name" error={errors.lastName?.message} {...register("lastName")} />
              </FormRow>

              <FormRow>
                <Input
                  label="Contact number"
                  required
                  icon={<Phone className="size-4" aria-hidden />}
                  autoComplete="tel"
                  error={errors.contactNumber?.message}
                  {...register("contactNumber")}
                />
                <Input label="ID number" hint="13-digit SA ID number, if available" error={errors.idNumber?.message} {...register("idNumber")} />
              </FormRow>

              <FormRow>
                <Input label="Date of birth" type="date" error={errors.dateOfBirth?.message} {...register("dateOfBirth")} />
                <div />
              </FormRow>

              <FormRow>
                <Input label="Department" placeholder="Outpatients" error={errors.department?.message} {...register("department")} />
                <Input label="Designation" placeholder="Professional Nurse" error={errors.designation?.message} {...register("designation")} />
              </FormRow>

              <FormRow>
                <Input label="SANC number" hint="Nurses only — leave blank otherwise" error={errors.sancNumber?.message} {...register("sancNumber")} />
                <Input label="SANC expiry date" type="date" error={errors.sancExpiryDate?.message} {...register("sancExpiryDate")} />
              </FormRow>

              <FormRow>
                <Input label="HPCSA number" hint="Doctors/allied health only" error={errors.hpcsaNumber?.message} {...register("hpcsaNumber")} />
                <Input label="HPCSA expiry date" type="date" error={errors.hpcsaExpiryDate?.message} {...register("hpcsaExpiryDate")} />
              </FormRow>

              <FormRow>
                <Input label="SAPC number" hint="Pharmacists only — leave blank otherwise" error={errors.sapcNumber?.message} {...register("sapcNumber")} />
                <Input label="SAPC expiry date" type="date" error={errors.sapcExpiryDate?.message} {...register("sapcExpiryDate")} />
              </FormRow>

              <div className="mt-1 flex flex-col gap-4 rounded-lg border border-border-subtle bg-surface-sunken p-4">
                <p className="text-[13px] font-semibold text-text-secondary">Emergency contact (optional)</p>
                <FormRow>
                  <Input label="Contact name" placeholder="Thandi Sithole" error={errors.emergencyContactName?.message} {...register("emergencyContactName")} />
                  <Input label="Relationship" placeholder="Sister" error={errors.emergencyContactRelationship?.message} {...register("emergencyContactRelationship")} />
                </FormRow>
                <Input
                  label="Contact phone"
                  icon={<Phone className="size-4" aria-hidden />}
                  placeholder="+27 83 123 4567"
                  error={errors.emergencyContactPhone?.message}
                  {...register("emergencyContactPhone")}
                />
              </div>

              <div className="mt-1 flex items-center gap-3">
                <Button type="submit" loading={isSubmitting || mutation.isPending} disabled={!isDirty}>
                  Save changes
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate("/app/staff")}>
                  Cancel
                </Button>
              </div>
            </form>
          </>
        )}
      </Card>

      {staffQuery.data && (
        <Card className="p-6 sm:p-8">
          <div className="mb-1 flex items-center gap-2">
            <Paperclip className="size-4 text-text-secondary" aria-hidden />
            <h2 className="text-[16px] font-semibold text-text-primary">Documents</h2>
          </div>
          <p className="mb-5 text-[13.5px] text-text-secondary">
            Qualification certificates, professional registration proof, ID copies, contracts and other paperwork.
          </p>

          {documentError && (
            <div role="alert" className="mb-4 rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-[13.5px] text-danger-600">
              {documentError}
            </div>
          )}

          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface-sunken p-4 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label htmlFor="staff-document-type" className="text-[13px] font-medium text-text-secondary">
                Document type
              </label>
              <select
                id="staff-document-type"
                value={documentType}
                onChange={(event) => setDocumentType(event.target.value as StaffDocumentType)}
                className="h-10 rounded-lg border border-border-strong bg-surface-base px-3 text-[13.5px] text-text-primary"
              >
                {STAFF_DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              variant="secondary"
              loading={uploadDocumentMutation.isPending}
              onClick={() => documentInputRef.current?.click()}
            >
              Upload document
            </Button>
            <input
              ref={documentInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={handleDocumentChange}
            />
          </div>

          {documentsQuery.isLoading ? (
            <p className="text-[13.5px] text-text-secondary">Loading…</p>
          ) : documentsQuery.isError ? (
            <p className="text-[13.5px] text-text-secondary">Documents couldn't be loaded.</p>
          ) : !documentsQuery.data || documentsQuery.data.length === 0 ? (
            <p className="text-[13.5px] text-text-secondary">No documents uploaded yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-subtle">
              {documentsQuery.data.map((doc) => {
                const typeLabel = STAFF_DOCUMENT_TYPE_OPTIONS.find((o) => o.value === doc.documentType)?.label ?? doc.documentType;
                return (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-5 shrink-0 text-text-secondary" aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium text-text-primary">{doc.originalFilename}</p>
                        <p className="text-[12px] text-text-secondary">
                          {typeLabel} · {formatFileSize(doc.fileSize)} · {formatRelativeDate(doc.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button type="button" variant="secondary" onClick={() => handleViewDocument(doc.id)}>
                        View
                      </Button>
                      {confirmDeleteId === doc.id ? (
                        <>
                          <Button type="button" variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            loading={deleteDocumentMutation.isPending}
                            onClick={() => deleteDocumentMutation.mutate(doc.id)}
                          >
                            Confirm
                          </Button>
                        </>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Remove ${doc.originalFilename}`}
                          onClick={() => setConfirmDeleteId(doc.id)}
                          className="flex size-9 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
