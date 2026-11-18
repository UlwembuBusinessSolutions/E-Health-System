import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, ShieldAlert, ShieldCheck, ShieldQuestion, Undo2 } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/shared/api/client";
import { getPatient } from "@/shared/api/patients";
import { getAllActiveProducts, type PharmacyProduct } from "@/shared/api/pharmacyStock";
import {
  addPatientAllergy,
  deactivatePatientAllergy,
  getPatientAllergies,
  reactivatePatientAllergy,
  setPatientAllergyStatus,
  updatePatientAllergy,
  type AllergenType,
  type AllergyPayload,
  type AllergySeverity,
  type PatientAllergy,
} from "@/shared/api/allergies";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { StatusPill } from "@/shared/components/StatusPill";
import { allergyQueryKey } from "./RegisteredAllergies";
import {
  ALLERGEN_TYPE_LABEL,
  ALLERGEN_TYPE_OPTIONS,
  ATC_PATTERN,
  SEVERITY_LABEL,
  SEVERITY_OPTIONS,
  canEditAllergies,
  formatIsoDate,
  severityTone,
  todayIso,
} from "./allergyLabels";

// The dedicated Patient Allergy Management page (/app/patients/:id/allergies). Records, edits and inactivates
// the patient's allergies, and records "no known allergies" or "unknown". The record it writes is the one every
// consultation, first-visit assessment and prescription for this patient reads.

interface AllergyDraft {
  allergenType: AllergenType | "";
  allergyCode: string;
  catalogProductId: string;
  allergyName: string;
  reaction: string;
  severity: AllergySeverity | "";
  dateIdentified: string;
  clinicalNotes: string;
}

const emptyDraft = (): AllergyDraft => ({
  allergenType: "",
  allergyCode: "",
  catalogProductId: "",
  allergyName: "",
  reaction: "",
  severity: "",
  dateIdentified: todayIso(),
  clinicalNotes: "",
});

const draftOf = (allergy: PatientAllergy): AllergyDraft => ({
  allergenType: allergy.allergenType,
  allergyCode: allergy.allergyCode ?? "",
  catalogProductId: "",
  allergyName: allergy.allergyName,
  reaction: allergy.reaction,
  severity: allergy.severity,
  dateIdentified: allergy.dateIdentified,
  clinicalNotes: allergy.clinicalNotes ?? "",
});

// Returns the first problem with the draft, or null. The server re-checks everything.
function validateDraft(draft: AllergyDraft): string | null {
  if (!draft.allergenType) return "Choose the allergen type.";
  const code = draft.allergyCode.trim().toUpperCase();
  if (draft.allergenType === "OTHER" && !draft.catalogProductId) return "Choose a supply or device.";
  if (draft.allergenType === "MEDICATION" && !draft.catalogProductId && !ATC_PATTERN.test(code)) {
    return "Choose a catalogue medicine or enter a valid ATC code.";
  }
  if (!draft.allergyName.trim()) return "Enter the allergy name or description.";
  if (!draft.reaction.trim()) return "Enter the reaction or symptoms.";
  if (!draft.severity) return "Choose the severity.";
  if (!draft.dateIdentified) return "Enter the date identified.";
  if (draft.dateIdentified > todayIso()) return "The date identified cannot be in the future.";
  return null;
}

function payloadOf(draft: AllergyDraft): AllergyPayload {
  return {
    allergyCode: draft.allergyCode.trim().toUpperCase() || undefined,
    catalogProductId: draft.catalogProductId || undefined,
    allergyName: draft.allergyName.trim(),
    allergenType: draft.allergenType as AllergenType,
    reaction: draft.reaction.trim(),
    severity: draft.severity as AllergySeverity,
    dateIdentified: draft.dateIdentified,
    clinicalNotes: draft.clinicalNotes.trim() || undefined,
  };
}

const errorText = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback);

export function PatientAllergyPage() {
  const { id } = useParams<{ id: string }>();
  const patientId = id ?? "";
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const patientQuery = useQuery({ queryKey: ["patients", patientId], queryFn: () => getPatient(patientId), enabled: !!patientId });
  const allergiesQuery = useQuery({
    queryKey: allergyQueryKey(patientId),
    queryFn: () => getPatientAllergies(patientId),
    enabled: !!patientId,
  });

  const patient = patientQuery.data;
  const record = allergiesQuery.data;
  const canEdit = canEditAllergies(user?.role) && !!patient && !patient.archived;

  const [editing, setEditing] = useState<{ allergy: PatientAllergy | null } | null>(null);
  const [draft, setDraft] = useState<AllergyDraft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [inactivating, setInactivating] = useState<{ id: string; reason: string } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: allergyQueryKey(patientId) });

  const save = useMutation({
    mutationFn: (payload: AllergyPayload) =>
      editing?.allergy ? updatePatientAllergy(patientId, editing.allergy.id, payload) : addPatientAllergy(patientId, payload),
    onSuccess: () => {
      setEditing(null);
      setFormError(null);
      refresh();
    },
    onError: (error) => setFormError(errorText(error, "Couldn't save that allergy. Try again.")),
  });

  const inactivate = useMutation({
    mutationFn: ({ allergyId, reason }: { allergyId: string; reason: string }) =>
      deactivatePatientAllergy(patientId, allergyId, reason),
    onSuccess: () => {
      setInactivating(null);
      setPageError(null);
      refresh();
    },
    onError: (error) => setPageError(errorText(error, "Couldn't mark that allergy inactive. Try again.")),
  });

  const reactivate = useMutation({
    mutationFn: (allergyId: string) => reactivatePatientAllergy(patientId, allergyId),
    onSuccess: () => {
      setPageError(null);
      refresh();
    },
    onError: (error) => setPageError(errorText(error, "Couldn't reactivate that allergy. Try again.")),
  });

  const recordStatus = useMutation({
    mutationFn: (status: "NONE_KNOWN" | "UNKNOWN") => setPatientAllergyStatus(patientId, status),
    onSuccess: () => {
      setPageError(null);
      refresh();
    },
    onError: (error) => setPageError(errorText(error, "Couldn't record the allergy status. Try again.")),
  });

  const startAdding = () => {
    setDraft(emptyDraft());
    setFormError(null);
    setEditing({ allergy: null });
  };
  const startEditing = (allergy: PatientAllergy) => {
    setDraft(draftOf(allergy));
    setFormError(null);
    setEditing({ allergy });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = validateDraft(draft);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    save.mutate(payloadOf(draft));
  };

  const active = (record?.allergies ?? []).filter((a) => a.status === "ACTIVE");
  const inactive = (record?.allergies ?? []).filter((a) => a.status === "INACTIVE");

  return (
    <div>
      <Link
        to={`/app/patients/${patientId}`}
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to patient record
      </Link>

      <PageHeader
        title="Patient allergies"
        description={patient ? `${patient.firstName} ${patient.lastName} · ${patient.mpiNumber}` : undefined}
        action={
          canEdit && !editing ? (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={startAdding}>
              Add allergy
            </Button>
          ) : undefined
        }
      />

      {patient?.archived && (
        <p role="status" className="mb-4 rounded-lg border border-border-strong bg-surface-sunken px-3.5 py-2.5 text-[13.5px] text-text-secondary">
          This patient record is archived, so allergies can be viewed but not changed.
        </p>
      )}
      {!canEditAllergies(user?.role) && (
        <p role="status" className="mb-4 rounded-lg border border-border-strong bg-surface-sunken px-3.5 py-2.5 text-[13.5px] text-text-secondary">
          Only clinical staff (nurse, doctor, clinician or occupational health practitioner) can change allergies.
        </p>
      )}
      {pageError && (
        <p role="alert" className="mb-4 text-[13.5px] text-danger-600">
          {pageError}
        </p>
      )}

      {allergiesQuery.isLoading || patientQuery.isLoading ? (
        <div className="h-32 animate-pulse rounded-xl bg-surface-sunken" />
      ) : allergiesQuery.isError || !record ? (
        <p role="alert" className="text-[13.5px] text-danger-600">
          {errorText(allergiesQuery.error, "Couldn't load the allergy record. Try again.")}
        </p>
      ) : (
        <>
          <StatusCard
            status={record.status}
            activeCount={record.activeCount}
            updatedAt={record.statusUpdatedAt}
            canEdit={canEdit}
            saving={recordStatus.isPending}
            onRecord={(status) => recordStatus.mutate(status)}
          />

          {editing && (
            <AllergyForm
              title={editing.allergy ? "Edit allergy" : "Add allergy"}
              draft={draft}
              setDraft={setDraft}
              error={formError}
              saving={save.isPending}
              onSubmit={submit}
              onCancel={() => {
                setEditing(null);
                setFormError(null);
              }}
            />
          )}

          <Card className="mb-6 p-6">
            <h2 className="mb-4 text-[14.5px] font-semibold text-text-primary">Current allergies</h2>
            {active.length === 0 ? (
              <p className="text-[13.5px] text-text-secondary">No active allergies are recorded.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {active.map((allergy) => (
                  <AllergyRow
                    key={allergy.id}
                    allergy={allergy}
                    canEdit={canEdit}
                    inactivating={inactivating?.id === allergy.id ? inactivating.reason : null}
                    saving={inactivate.isPending}
                    onEdit={() => startEditing(allergy)}
                    onStartInactivate={() => setInactivating({ id: allergy.id, reason: "" })}
                    onReasonChange={(reason) => setInactivating({ id: allergy.id, reason })}
                    onCancelInactivate={() => setInactivating(null)}
                    onConfirmInactivate={() => inactivate.mutate({ allergyId: allergy.id, reason: inactivating?.reason ?? "" })}
                  />
                ))}
              </ul>
            )}
          </Card>

          {inactive.length > 0 && (
            <Card className="mb-6 p-6">
              <h2 className="mb-1 text-[14.5px] font-semibold text-text-primary">Inactive allergies</h2>
              <p className="mb-4 text-[12.5px] text-text-secondary">
                Resolved or entered in error. Kept for the record; they are not shown as current and do not block prescribing.
              </p>
              <ul className="divide-y divide-border-subtle">
                {inactive.map((allergy) => (
                  <li key={allergy.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-text-secondary line-through">{allergy.allergyName}</p>
                      <p className="text-[12.5px] text-text-secondary">
                        {ALLERGEN_TYPE_LABEL[allergy.allergenType]}
                        {allergy.allergyCode ? ` · ${allergy.allergyCode}` : ""} · Inactive: {allergy.inactiveReason}
                      </p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Undo2 className="size-3.5" aria-hidden />}
                        loading={reactivate.isPending && reactivate.variables === allergy.id}
                        onClick={() => reactivate.mutate(allergy.id)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatusCard({
  status,
  activeCount,
  updatedAt,
  canEdit,
  saving,
  onRecord,
}: {
  status: "UNKNOWN" | "NONE_KNOWN" | "KNOWN";
  activeCount: number;
  updatedAt: string | null;
  canEdit: boolean;
  saving: boolean;
  onRecord: (status: "NONE_KNOWN" | "UNKNOWN") => void;
}) {
  const Icon = status === "KNOWN" ? ShieldAlert : status === "NONE_KNOWN" ? ShieldCheck : ShieldQuestion;
  const tone = status === "KNOWN" ? "danger" : status === "NONE_KNOWN" ? "success" : "warning";
  const label = status === "KNOWN" ? "Known allergies" : status === "NONE_KNOWN" ? "No known allergies" : "Allergy status unknown";
  const explanation =
    status === "KNOWN"
      ? `${activeCount} active ${activeCount === 1 ? "allergy" : "allergies"} recorded. They are shown during consultations and block matching medicines at prescribing.`
      : status === "NONE_KNOWN"
        ? "The patient was asked and reports no allergies."
        : "The patient has not been asked yet. Ask, then record an allergy or \"no known allergies\".";

  return (
    <Card className="mb-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-5 text-text-secondary" aria-hidden />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[14.5px] font-semibold text-text-primary">Allergy status</h2>
              <StatusPill tone={tone}>{label}</StatusPill>
            </div>
            <p className="mt-1 text-[13px] text-text-secondary">{explanation}</p>
            {updatedAt && status !== "KNOWN" && (
              <p className="mt-0.5 text-[12.5px] text-text-secondary">Last recorded {formatIsoDate(updatedAt.slice(0, 10))}.</p>
            )}
          </div>
        </div>
        {canEdit && activeCount === 0 && (
          <div className="flex flex-wrap gap-2">
            {status !== "NONE_KNOWN" && (
              <Button variant="secondary" size="md" loading={saving} onClick={() => onRecord("NONE_KNOWN")}>
                Record no known allergies
              </Button>
            )}
            {status !== "UNKNOWN" && (
              <Button variant="secondary" size="md" loading={saving} onClick={() => onRecord("UNKNOWN")}>
                Mark status unknown
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function AllergyRow({
  allergy,
  canEdit,
  inactivating,
  saving,
  onEdit,
  onStartInactivate,
  onReasonChange,
  onCancelInactivate,
  onConfirmInactivate,
}: {
  allergy: PatientAllergy;
  canEdit: boolean;
  /** The reason being typed while this row is being marked inactive; null otherwise. */
  inactivating: string | null;
  saving: boolean;
  onEdit: () => void;
  onStartInactivate: () => void;
  onReasonChange: (reason: string) => void;
  onCancelInactivate: () => void;
  onConfirmInactivate: () => void;
}) {
  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-text-primary">{allergy.allergyName}</p>
            <StatusPill tone={severityTone(allergy.severity)}>{SEVERITY_LABEL[allergy.severity]}</StatusPill>
          </div>
          <p className="mt-0.5 text-[13px] text-text-secondary">
            {ALLERGEN_TYPE_LABEL[allergy.allergenType]}
            {allergy.allergyCode ? ` · ${allergy.allergyCode}` : ""} · Identified {formatIsoDate(allergy.dateIdentified)}
          </p>
          <p className="mt-1 text-[13.5px] text-text-primary">
            <span className="font-medium">Reaction:</span> {allergy.reaction}
          </p>
          {allergy.clinicalNotes && <p className="mt-0.5 whitespace-pre-line text-[13px] text-text-secondary">{allergy.clinicalNotes}</p>}
        </div>
        {canEdit && inactivating === null && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="md" icon={<Pencil className="size-3.5" aria-hidden />} onClick={onEdit}>
              Edit
            </Button>
            <Button variant="secondary" size="md" onClick={onStartInactivate}>
              Mark inactive
            </Button>
          </div>
        )}
      </div>
      {inactivating !== null && (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border-strong p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Reason for marking inactive"
              required
              placeholder="e.g. Resolved, tolerated since, or entered in error"
              value={inactivating}
              onChange={(e) => onReasonChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button loading={saving} disabled={inactivating.trim().length < 3} onClick={onConfirmInactivate}>
              Confirm
            </Button>
            <Button variant="secondary" onClick={onCancelInactivate}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function AllergyForm({
  title,
  draft,
  setDraft,
  error,
  saving,
  onSubmit,
  onCancel,
}: {
  title: string;
  draft: AllergyDraft;
  setDraft: (updater: (draft: AllergyDraft) => AllergyDraft) => void;
  error: string | null;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
}) {
  const isMedication = draft.allergenType === "MEDICATION";
  const catalog = useQuery({
    queryKey: ["pharmacy-products", "allergy-options"],
    queryFn: getAllActiveProducts,
    enabled: !!draft.allergenType,
    staleTime: 5 * 60_000,
  });
  const products = catalog.data ?? [];
  const medicineProducts = products.filter((product) => product.category === "MEDICINE");
  const otherProducts = products.filter((product) => product.category !== "MEDICINE");
  const optionsFor = (items: PharmacyProduct[]) => items.map((product) => ({
    value: product.id,
    label: `${product.displayName}${product.atcCode ? ` (${product.atcCode})` : " (ATC unavailable; product-linked)"}`,
  }));
  const selectedProductId = products.some((product) => product.id === draft.catalogProductId)
    ? draft.catalogProductId : "";
  const set = <K extends keyof AllergyDraft>(key: K, value: AllergyDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const onProductChange = (productId: string) => {
    const product = products.find((entry) => entry.id === productId);
    setDraft((d) => ({
      ...d,
      catalogProductId: productId,
      allergyCode: product?.atcCode ?? "",
      allergyName: product?.genericName || product?.displayName || d.allergyName,
    }));
  };  return (
    <Card className="mb-6 p-6">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <h2 className="text-[14.5px] font-semibold text-text-primary">{title}</h2>
        {error && (
          <p role="alert" className="text-[13.5px] text-danger-600">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Allergen type"
            required
            options={ALLERGEN_TYPE_OPTIONS}
            value={draft.allergenType}
            onChange={(e) => {
              const allergenType = e.target.value as AllergenType;
              setDraft((d) => ({
                ...d,
                allergenType,
                allergyCode: "", catalogProductId: "",
              }));
            }}
          />
          {isMedication ? (
            <div>
              <Select
                label="Medication product"
                required
                options={optionsFor(medicineProducts)}
                value={selectedProductId}
                disabled={catalog.isLoading || medicineProducts.length === 0}
                placeholder={catalog.isLoading ? "Loading medicine catalogue..." : "Choose a medicine"}
                hint="All medicines are listed; items without an ATC code are checked by exact product."
                onChange={(e) => onProductChange(e.target.value)}
              />
              {catalog.isError && (
                <p role="alert" className="mt-1.5 text-[13px] text-danger-600">
                  {errorText(catalog.error, "Could not load products from the pharmacy catalogue.")}
                </p>
              )}
              {!catalog.isLoading && !catalog.isError && medicineProducts.length === 0 && (
                <p role="status" className="mt-1.5 text-[13px] text-text-secondary">
                  No active medicines are available in the pharmacy catalogue.
                </p>
              )}
            </div>
          ) : draft.allergenType === "OTHER" ? (
            <Select
              label="Supply or device"
              required
              options={optionsFor(otherProducts)}
              value={selectedProductId}
              disabled={catalog.isLoading || otherProducts.length === 0}
              placeholder={catalog.isLoading ? "Loading catalogue..." : "Choose a supply or device"}
              onChange={(e) => onProductChange(e.target.value)}
            />
          ) : (
            <Input
              label="Allergy code"
              maxLength={20}
              placeholder="Optional"
              value={draft.allergyCode}
              onChange={(e) => set("allergyCode", e.target.value.toUpperCase())}
            />
          )}          <Input
            label="Allergy name or description"
            required
            maxLength={200}
            placeholder="e.g. Penicillin, Peanuts, Latex"
            value={draft.allergyName}
            onChange={(e) => set("allergyName", e.target.value)}
          />
          <Select
            label="Severity"
            required
            options={SEVERITY_OPTIONS}
            value={draft.severity}
            onChange={(e) => set("severity", e.target.value as AllergySeverity)}
          />
          <Input
            label="Reaction or symptoms"
            required
            maxLength={500}
            placeholder="e.g. Hives, swelling of the lips, anaphylaxis"
            value={draft.reaction}
            onChange={(e) => set("reaction", e.target.value)}
          />
          <Input
            label="Date identified"
            type="date"
            required
            max={todayIso()}
            value={draft.dateIdentified}
            onChange={(e) => set("dateIdentified", e.target.value)}
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-text-primary">
            Additional clinical notes <span className="font-normal text-text-secondary">(optional)</span>
          </span>
          <textarea
            className="min-h-[84px] rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            maxLength={2000}
            value={draft.clinicalNotes}
            onChange={(e) => set("clinicalNotes", e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" loading={saving}>
            Save allergy
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}