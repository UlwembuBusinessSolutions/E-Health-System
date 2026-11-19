import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationLongitudinalRecords,
  saveArtInitiationLongitudinalRecord,
  type ArtInitiationLongitudinalRecord,
  type ArtInitiationStage,
} from "@/shared/api/artInitiationLongitudinalRecords";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";

interface Draft {
  recordDate: string;
  durationOnArtMonths: string;
  stage: ArtInitiationStage | "";
  patientWeightKg: string;
  viralLoad: string;
  cd4Count: string;
  stageDescription: string;
}

const EMPTY_DRAFT: Draft = {
  recordDate: "",
  durationOnArtMonths: "",
  stage: "",
  patientWeightKg: "",
  viralLoad: "",
  cd4Count: "",
  stageDescription: "",
};

const STAGES: { value: ArtInitiationStage; label: string }[] = [
  { value: "STAGE_1", label: "Stage 1" },
  { value: "STAGE_2", label: "Stage 2" },
  { value: "STAGE_3", label: "Stage 3" },
  { value: "STAGE_4", label: "Stage 4" },
];

const inputClass =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatSignedAt(value: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArtInitiationLongitudinalRecordForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);

  const recordsQuery = useQuery({
    queryKey: ["art-initiation-longitudinal-records", visitId],
    queryFn: () => getArtInitiationLongitudinalRecords(visitId),
    enabled: open,
    retry: false,
  });

  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
  }, [open]);

  const save = useMutation({
    mutationFn: () =>
      saveArtInitiationLongitudinalRecord(visitId, {
        recordDate: draft.recordDate,
        durationOnArtMonths: draft.durationOnArtMonths === "" ? null : Number(draft.durationOnArtMonths),
        stage: draft.stage as ArtInitiationStage,
        patientWeightKg: draft.patientWeightKg === "" ? null : Number(draft.patientWeightKg),
        viralLoad: draft.viralLoad.trim() || null,
        cd4Count: draft.cd4Count.trim() || null,
        stageDescription: draft.stageDescription.trim() || null,
      }),
    onSuccess: (record) => {
      queryClient.setQueryData<ArtInitiationLongitudinalRecord[]>(
        ["art-initiation-longitudinal-records", visitId],
        (current = []) => [record, ...current].sort((a, b) => b.recordDate.localeCompare(a.recordDate)),
      );
      setDraft(EMPTY_DRAFT);
      setSaveError(null);
      setOpen(false);
      showToast("ART initiation longitudinal record signed.", "success");
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? error.message : "Couldn't save the ART initiation longitudinal record. Try again.",
      );
    },
  });

  const canSave = draft.recordDate !== "" && draft.stage !== "";

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveError(null);
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<Activity className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Capture Longitudinal Records
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture Longitudinal Records"
        description="Add an ART clinical staging record to this Adult ART Initiation visit. Date and stage are required; other fields are optional."
        dismissible={!save.isPending}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={save.isPending} onClick={resetDraft}>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
              Reset
            </Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!canSave || save.isPending}
              onClick={() => save.mutate()}
            >
              Save and sign
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {recordsQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">
                Couldn't load the saved initiation records. You can still add a record and try saving it.
              </p>
              <Button variant="secondary" size="md" onClick={() => recordsQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {recordsQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved records…</p>
          ) : (recordsQuery.data?.length ?? 0) > 0 ? (
            <section aria-label="Saved Adult ART Initiation longitudinal records" className="flex flex-col gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-text-primary">Signed records for this visit</h3>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  Signed records are kept in this visit's history. Reset only clears the new entry below.
                </p>
              </div>
              {recordsQuery.data?.map((record) => (
                <article key={record.id} className="rounded-xl border border-border-subtle bg-surface-sunken/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-semibold text-text-primary">
                        {STAGES.find((stage) => stage.value === record.stage)?.label}
                      </p>
                      <p className="mt-0.5 text-[12px] text-text-secondary">Record date: {formatDate(record.recordDate)}</p>
                    </div>
                    <span className="rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
                      Signed
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
                    {record.durationOnArtMonths !== null && (
                      <div><dt className="font-medium text-text-secondary">Duration on ART</dt><dd className="text-text-primary">{record.durationOnArtMonths} months</dd></div>
                    )}
                    {record.patientWeightKg !== null && (
                      <div><dt className="font-medium text-text-secondary">Patient weight</dt><dd className="text-text-primary">{record.patientWeightKg} kg</dd></div>
                    )}
                    {record.viralLoad && (
                      <div><dt className="font-medium text-text-secondary">Viral load</dt><dd className="text-text-primary">{record.viralLoad}</dd></div>
                    )}
                    {record.cd4Count && (
                      <div><dt className="font-medium text-text-secondary">CD4 count</dt><dd className="text-text-primary">{record.cd4Count}</dd></div>
                    )}
                    {record.stageDescription && (
                      <div className="sm:col-span-2"><dt className="font-medium text-text-secondary">Stage description</dt><dd className="whitespace-pre-wrap text-text-primary">{record.stageDescription}</dd></div>
                    )}
                  </dl>
                  <p className="mt-3 border-t border-border-subtle pt-2.5 text-[11.5px] text-text-secondary">
                    Signed by {record.signedByName ?? "Clinical staff"} · {formatSignedAt(record.signedAt)}
                  </p>
                </article>
              ))}
            </section>
          ) : !recordsQuery.isError ? (
            <p className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
              No longitudinal records have been signed for this initiation visit yet.
            </p>
          ) : null}

          <section aria-label="New Adult ART Initiation longitudinal record" className="flex flex-col gap-4 rounded-xl border border-brand-500/20 bg-surface-raised p-4 shadow-sm">
            <div>
              <h3 className="text-[13px] font-semibold text-text-primary">New longitudinal record</h3>
              <p className="mt-0.5 text-[12px] text-text-secondary">
                This entry will be saved to the current Adult ART Initiation visit.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Date <span className="text-danger-600" aria-hidden="true">*</span>
                <input
                  type="date"
                  required
                  className={inputClass}
                  value={draft.recordDate}
                  onChange={(event) => updateDraft({ recordDate: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Stage <span className="text-danger-600" aria-hidden="true">*</span>
                <select
                  required
                  className={inputClass}
                  value={draft.stage}
                  onChange={(event) => updateDraft({ stage: event.target.value as ArtInitiationStage | "" })}
                >
                  <option value="">Select stage</option>
                  {STAGES.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Duration Time in Months on ART
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={inputClass}
                  placeholder="e.g. 18"
                  value={draft.durationOnArtMonths}
                  onChange={(event) => updateDraft({ durationOnArtMonths: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Patient Weight (kg)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputClass}
                  placeholder="e.g. 65.5"
                  value={draft.patientWeightKg}
                  onChange={(event) => updateDraft({ patientWeightKg: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Viral Load
                <input
                  type="text"
                  maxLength={200}
                  className={inputClass}
                  placeholder="e.g. 850 copies/mL or undetectable"
                  value={draft.viralLoad}
                  onChange={(event) => updateDraft({ viralLoad: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                CD4 Count
                <input
                  type="text"
                  maxLength={200}
                  className={inputClass}
                  placeholder="Enter CD4 count"
                  value={draft.cd4Count}
                  onChange={(event) => updateDraft({ cd4Count: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary sm:col-span-2">
                Description with regards to the stage-defining illness, regimen change, hospitalisation details, Pap, etc.
                <textarea
                  maxLength={10_000}
                  rows={3}
                  className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="Describe the relevant clinical details"
                  value={draft.stageDescription}
                  onChange={(event) => updateDraft({ stageDescription: event.target.value })}
                />
              </label>
            </div>
          </section>

          {saveError && <p role="alert" className="text-[13px] text-danger-600">{saveError}</p>}
        </div>
      </Modal>
    </>
  );
}
