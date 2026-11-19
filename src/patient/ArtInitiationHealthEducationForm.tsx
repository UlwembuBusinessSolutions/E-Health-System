import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationHealthEducation,
  saveArtInitiationHealthEducation,
  type ArtInitiationHealthEducation,
  type SaveArtInitiationHealthEducationPayload,
} from "@/shared/api/artInitiationHealthEducation";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { Modal } from "@/pharmacy/components/Modal";

type HealthEducationDraft = Omit<SaveArtInitiationHealthEducationPayload, "otherSpecify"> & {
  otherSpecify: string;
};

const EMPTY_DRAFT: HealthEducationDraft = {
  condomImportance: null,
  healthyLifestyleDiet: null,
  partnerTesting: null,
  hivStatusDisclosure: null,
  adherenceCompliance: null,
  familyPlanning: null,
  generalHivInformation: null,
  regularPapSmear: null,
  medicationSideEffects: null,
  clinicAttendanceForHealthIssues: null,
  herbalTraditionalMedicationDiscussion: null,
  otherDiscussed: null,
  otherSpecify: "",
};

const TOPICS: { key: keyof Omit<HealthEducationDraft, "otherSpecify">; label: string }[] = [
  { key: "condomImportance", label: "Importance of condomising" },
  { key: "healthyLifestyleDiet", label: "Healthy lifestyle, including a healthy diet" },
  { key: "partnerTesting", label: "Importance of partner testing" },
  { key: "hivStatusDisclosure", label: "Importance of disclosing HIV status" },
  { key: "adherenceCompliance", label: "Importance of adherence and compliance with treatment" },
  { key: "familyPlanning", label: "Importance of family planning" },
  { key: "generalHivInformation", label: "General HIV information (CD4 and viral load)" },
  { key: "regularPapSmear", label: "Importance of regular Pap smear screening" },
  { key: "medicationSideEffects", label: "Discussion about medication side effects" },
  { key: "clinicAttendanceForHealthIssues", label: "Importance of attending the clinic if health issues arise" },
  {
    key: "herbalTraditionalMedicationDiscussion",
    label: "Discussion on how herbal and traditional medicines may affect ARV treatment",
  },
];

const textareaClass =
  "min-h-24 w-full resize-y rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function YesNoQuestion({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-raised p-3.5">
      <legend className="px-1 text-[12.5px] font-medium text-text-primary">{label}</legend>
      <div className="flex gap-5">
        {([true, false] as const).map((answer) => (
          <label key={String(answer)} className="flex items-center gap-2 text-[13px] text-text-primary">
            <input
              type="radio"
              name={`health-education-${name}`}
              checked={value === answer}
              onChange={() => onChange(answer)}
              className="size-4 accent-brand-600"
            />
            {answer ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ArtInitiationHealthEducationForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<HealthEducationDraft>(EMPTY_DRAFT);
  const [saveError, setSaveError] = useState<string | null>(null);

  const detailsQuery = useQuery({
    queryKey: ["art-initiation-health-education", visitId],
    queryFn: () => getArtInitiationHealthEducation(visitId),
    enabled: open,
  });

  useEffect(() => {
    if (!open || detailsQuery.data === undefined) return;
    const saved: ArtInitiationHealthEducation | null = detailsQuery.data;
    setDraft(saved ? {
      condomImportance: saved.condomImportance,
      healthyLifestyleDiet: saved.healthyLifestyleDiet,
      partnerTesting: saved.partnerTesting,
      hivStatusDisclosure: saved.hivStatusDisclosure,
      adherenceCompliance: saved.adherenceCompliance,
      familyPlanning: saved.familyPlanning,
      generalHivInformation: saved.generalHivInformation,
      regularPapSmear: saved.regularPapSmear,
      medicationSideEffects: saved.medicationSideEffects,
      clinicAttendanceForHealthIssues: saved.clinicAttendanceForHealthIssues,
      herbalTraditionalMedicationDiscussion: saved.herbalTraditionalMedicationDiscussion,
      otherDiscussed: saved.otherDiscussed,
      otherSpecify: saved.otherSpecify ?? "",
    } : EMPTY_DRAFT);
  }, [open, detailsQuery.data]);

  const save = useMutation({
    mutationFn: () => {
      const payload: SaveArtInitiationHealthEducationPayload = {
        ...draft,
        otherSpecify: draft.otherDiscussed === true ? draft.otherSpecify.trim() || null : null,
      };
      return saveArtInitiationHealthEducation(visitId, payload);
    },
    onSuccess: (details) => {
      queryClient.setQueryData(["art-initiation-health-education", visitId], details);
      setSaveError(null);
      setOpen(false);
      showToast("Health education details saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError
        ? error.message
        : "Couldn't save the health education details. Try again.");
    },
  });

  function updateAnswer(key: keyof Omit<HealthEducationDraft, "otherSpecify">, value: boolean) {
    setDraft((current) => ({
      ...current,
      [key]: value,
      ...(key === "otherDiscussed" && !value ? { otherSpecify: "" } : {}),
    }));
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
        icon={<BookOpenCheck className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Capture Health Educational Details
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Capture Health Educational Details"
        description="Record the health education topics discussed during this Adult ART Initiation visit."
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
              disabled={detailsQuery.isLoading || detailsQuery.isError}
              onClick={() => save.mutate()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {detailsQuery.isError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-50 p-3">
              <p className="text-[13px] text-danger-700">Couldn't load saved health education details.</p>
              <Button variant="secondary" size="md" onClick={() => detailsQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {detailsQuery.isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading saved education details…</p>
          ) : (
            <>
              {detailsQuery.data ? (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  Health education details are saved for this visit. Saving changes will update them. Reset clears the
                  form; saved details change only when you save.
                  <span className="mt-1 block text-brand-700">
                    Last saved by {detailsQuery.data.updatedByName ?? "Clinical staff"} · {formatUpdatedAt(detailsQuery.data.updatedAt)}
                  </span>
                </p>
              ) : !detailsQuery.isError ? (
                <p role="status" className="rounded-lg bg-surface-sunken px-3.5 py-3 text-[13px] text-text-secondary">
                  No health education details are saved for this visit yet.
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TOPICS.map((topic) => (
                  <YesNoQuestion
                    key={topic.key}
                    name={topic.key}
                    label={topic.label}
                    value={draft[topic.key]}
                    onChange={(value) => updateAnswer(topic.key, value)}
                  />
                ))}
                <YesNoQuestion
                  name="other-discussed"
                  label="Other"
                  value={draft.otherDiscussed}
                  onChange={(value) => updateAnswer("otherDiscussed", value)}
                />
              </div>

              {draft.otherDiscussed === true && (
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  Specify
                  <textarea
                    className={textareaClass}
                    maxLength={10_000}
                    value={draft.otherSpecify}
                    onChange={(event) => {
                      setDraft((current) => ({ ...current, otherSpecify: event.target.value }));
                      setSaveError(null);
                    }}
                    placeholder="Specify other health education details"
                  />
                  <span className="text-right text-[11px] font-normal text-text-secondary">
                    {draft.otherSpecify.length}/10,000 characters
                  </span>
                </label>
              )}
              {saveError && <p role="alert" className="text-[13px] text-danger-700">{saveError}</p>}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
