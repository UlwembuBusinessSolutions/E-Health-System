import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Activity } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtLongitudinalRecords,
  saveArtLongitudinalRecord,
  type ArtStage,
} from "@/shared/api/artLongitudinalRecords";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/pharmacy/components/Modal";

interface ArtLongitudinalRecordDraft {
  recordDate: string;
  durationOnArt: string;
  stage: ArtStage | "";
  viralLoad: string;
  cd4Count: string;
  stageDescription: string;
}

const EMPTY_DRAFT: ArtLongitudinalRecordDraft = {
  recordDate: "",
  durationOnArt: "",
  stage: "",
  viralLoad: "",
  cd4Count: "",
  stageDescription: "",
};

const STAGES: { value: ArtStage; label: string }[] = [
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

export function ArtLongitudinalRecordForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ArtLongitudinalRecordDraft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const recordsQuery = useQuery({
    queryKey: ["art-longitudinal-records", visitId],
    queryFn: () => getArtLongitudinalRecords(visitId),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () =>
      saveArtLongitudinalRecord(visitId, {
        recordDate: draft.recordDate,
        durationOnArt: draft.durationOnArt.trim() || undefined,
        stage: draft.stage as ArtStage,
        viralLoad: draft.viralLoad.trim() || undefined,
        cd4Count: draft.cd4Count.trim() || undefined,
        stageDescription: draft.stageDescription.trim() || undefined,
      }),
    onSuccess: () => {
      setDraft(EMPTY_DRAFT);
      setSaveError(null);
      setSavedMessage("Longitudinal record saved and signed.");
      queryClient.invalidateQueries({ queryKey: ["art-longitudinal-records", visitId] });
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? error.message : "Couldn't save the ART longitudinal record. Try again.",
      );
    },
  });

  const canSave = draft.recordDate !== "" && draft.stage !== "";

  function updateDraft(patch: Partial<ArtLongitudinalRecordDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveError(null);
    setSavedMessage(null);
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
    setSaveError(null);
    setSavedMessage(null);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<Activity className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setSavedMessage(null);
          setOpen(true);
        }}
      >
        Capture Longitudinal Records
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture Longitudinal Records"
        description="Record ART history for this visit. Date and stage are required; other values are optional."
        dismissible={!save.isPending}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={save.isPending} onClick={resetDraft}>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
              Reset
            </Button>
            <Button variant="secondary" disabled={save.isPending} onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={!canSave}
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
              <p className="text-[13px] text-danger-700">Couldn’t load saved longitudinal records.</p>
              <Button variant="secondary" size="md" onClick={() => recordsQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {recordsQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved records…</p>
          ) : (recordsQuery.data?.length ?? 0) > 0 ? (
            <section aria-label="Previously saved ART longitudinal records" className="flex flex-col gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-text-primary">Saved records</h3>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  Signed records are kept as recorded and aren’t cleared by Reset.
                </p>
              </div>
              {recordsQuery.data?.map((record) => (
                <article key={record.id} className="rounded-xl border border-border-subtle bg-surface-sunken/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-semibold text-text-primary">
                        {STAGES.find((stage) => stage.value === record.stage)?.label}
                      </p>
                      <p className="mt-0.5 text-[12px] text-text-secondary">
                        Record date: {formatDate(record.recordDate)}
                      </p>
                    </div>
                    <span className="rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
                      Signed
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 text-[12.5px] sm:grid-cols-2">
                    {record.durationOnArt && (
                      <div><dt className="font-medium text-text-secondary">Duration on ART</dt><dd className="text-text-primary">{record.durationOnArt}</dd></div>
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
          ) : (
            <p className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
              No ART longitudinal records have been saved for this visit yet.
            </p>
          )}

          <section aria-label="New ART longitudinal record" className="flex flex-col gap-4 rounded-xl border border-brand-500/20 bg-surface-raised p-4 shadow-sm">
            <div>
              <h3 className="text-[13px] font-semibold text-text-primary">New longitudinal record</h3>
              <p className="mt-0.5 text-[12px] text-text-secondary">
                Saving attributes this record to your signed-in account.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Select Date <span className="text-danger-600" aria-hidden="true">*</span>
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
                  onChange={(event) => updateDraft({ stage: event.target.value as ArtStage | "" })}
                >
                  <option value="">Select stage</option>
                  {STAGES.map((stage) => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Duration Time in Months on ART System
                <input
                  type="text"
                  maxLength={200}
                  className={inputClass}
                  placeholder="e.g. 18 months"
                  value={draft.durationOnArt}
                  onChange={(event) => updateDraft({ durationOnArt: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Viral Load
                <input
                  type="text"
                  maxLength={200}
                  className={inputClass}
                  placeholder="Enter viral load"
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
                Description with regards to the stage defining
                <textarea
                  maxLength={10_000}
                  rows={3}
                  className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  placeholder="Describe the information supporting this stage"
                  value={draft.stageDescription}
                  onChange={(event) => updateDraft({ stageDescription: event.target.value })}
                />
              </label>
            </div>
          </section>

          {saveError && <p role="alert" className="text-[13px] text-danger-600">{saveError}</p>}
          {savedMessage && <p role="status" className="text-[13px] text-success-700">{savedMessage}</p>}
        </div>
      </Modal>
    </>
  );
}
