import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Plus, RotateCcw, Trash2 } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getLaboratoryInvestigations,
  saveLaboratoryInvestigations,
  type CreateLaboratoryInvestigation,
} from "@/shared/api/laboratoryInvestigations";
import { Button } from "@/shared/components/Button";
import { Modal } from "@/pharmacy/components/Modal";
import { generateUUID } from "@/utils/uuid";

interface InvestigationDraft extends CreateLaboratoryInvestigation {
  key: string;
}

const inputClass =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function emptyDraft(): InvestigationDraft {
  return { key: generateUUID(), investigationDate: "", testName: "", testResults: "" };
}

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

export function LaboratoryInvestigationForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<InvestigationDraft[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["laboratory-investigations", visitId],
    queryFn: () => getLaboratoryInvestigations(visitId),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () =>
      saveLaboratoryInvestigations(
        visitId,
        drafts.map(({ investigationDate, testName, testResults }) => ({
          investigationDate,
          testName: testName.trim(),
          testResults: testResults.trim(),
        })),
      ),
    onSuccess: (saved) => {
      setSaveError(null);
      setSavedMessage(
        saved.length === 1 ? "Investigation saved and signed." : `${saved.length} investigations saved and signed.`,
      );
      setDrafts([emptyDraft()]);
      queryClient.invalidateQueries({ queryKey: ["laboratory-investigations", visitId] });
    },
    onError: (error) => {
      setSaveError(
        error instanceof ApiError ? error.message : "Couldn't save the laboratory investigations. Try again.",
      );
    },
  });

  const canSave =
    drafts.length > 0 &&
    drafts.every(
      (draft) =>
        draft.investigationDate !== "" &&
        draft.testName.trim().length > 0 &&
        draft.testResults.trim().length > 0,
    );

  function updateDraft(key: string, patch: Partial<CreateLaboratoryInvestigation>) {
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
    setSavedMessage(null);
    setSaveError(null);
  }

  function openForm() {
    setDrafts((current) => (current.length === 0 ? [emptyDraft()] : current));
    setSaveError(null);
    setSavedMessage(null);
    setOpen(true);
  }

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<FlaskConical className="size-4" aria-hidden />}
        onClick={openForm}
      >
        Laboratory Investigation
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Laboratory Investigation"
        description="Record one or more test results for this visit. Saving records and attributes them to your signed-in account."
        dismissible={!save.isPending}
        onClose={() => setOpen(false)}
        footer={
          <>
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
          {historyQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn’t load saved investigations.</p>
              <Button variant="secondary" size="md" onClick={() => historyQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}

          {historyQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved investigations…</p>
          ) : (historyQuery.data?.length ?? 0) > 0 ? (
            <section aria-label="Previously saved laboratory investigations" className="flex flex-col gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-text-primary">Saved investigations</h3>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  Signed results are kept as recorded; they aren’t reset or removed from this form.
                </p>
              </div>
              {historyQuery.data?.map((item) => (
                <article key={item.id} className="rounded-xl border border-border-subtle bg-surface-sunken/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[13.5px] font-semibold text-text-primary">{item.testName}</p>
                      <p className="mt-0.5 text-[12px] text-text-secondary">Test date: {formatDate(item.investigationDate)}</p>
                    </div>
                    <span className="rounded-full bg-success-50 px-2.5 py-1 text-[11px] font-semibold text-success-700">
                      Signed
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[13px] text-text-primary">{item.testResults}</p>
                  <p className="mt-3 border-t border-border-subtle pt-2.5 text-[11.5px] text-text-secondary">
                    Signed by {item.signedByName ?? "Clinical staff"} · {formatSignedAt(item.signedAt)}
                  </p>
                </article>
              ))}
            </section>
          ) : (
            <p className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
              No laboratory investigations have been saved for this visit yet.
            </p>
          )}

          <section aria-label="New laboratory investigations" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-text-primary">Add test results</h3>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  Each card is saved as a separate signed record.
                </p>
              </div>
              <Button
                variant="secondary"
                size="md"
                icon={<Plus className="size-3.5" aria-hidden />}
                disabled={drafts.length >= 50 || save.isPending}
                onClick={() => {
                  setDrafts((current) => [...current, emptyDraft()]);
                  setSaveError(null);
                  setSavedMessage(null);
                }}
              >
                Add investigation
              </Button>
            </div>

            {drafts.map((draft, index) => (
              <article
                key={draft.key}
                className="rounded-xl border border-brand-500/20 bg-surface-raised p-4 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h4 className="text-[13px] font-semibold text-text-primary">Investigation {index + 1}</h4>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={save.isPending}
                      onClick={() => updateDraft(draft.key, { investigationDate: "", testName: "", testResults: "" })}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-text-secondary hover:bg-surface-sunken disabled:opacity-50"
                    >
                      <RotateCcw className="size-3.5" aria-hidden /> Reset
                    </button>
                    {drafts.length > 1 && (
                      <button
                        type="button"
                        disabled={save.isPending}
                        onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-danger-600 hover:bg-danger-50 disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" aria-hidden /> Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.2fr)]">
                  <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                    Date
                    <input
                      type="date"
                      required
                      className={inputClass}
                      value={draft.investigationDate}
                      onChange={(event) => updateDraft(draft.key, { investigationDate: event.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                    Test
                    <input
                      type="text"
                      required
                      maxLength={200}
                      className={inputClass}
                      placeholder="e.g. Full blood count"
                      value={draft.testName}
                      onChange={(event) => updateDraft(draft.key, { testName: event.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary sm:col-span-2">
                    Test results
                    <textarea
                      required
                      maxLength={10_000}
                      rows={3}
                      className="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      placeholder="Enter the result and any relevant units or interpretation"
                      value={draft.testResults}
                      onChange={(event) => updateDraft(draft.key, { testResults: event.target.value })}
                    />
                  </label>
                </div>
              </article>
            ))}
          </section>

          {saveError && <p role="alert" className="text-[13px] text-danger-600">{saveError}</p>}
          {savedMessage && <p role="status" className="text-[13px] text-success-700">{savedMessage}</p>}
        </div>
      </Modal>
    </>
  );
}
