import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, RotateCcw } from "lucide-react";
import { ApiError } from "@/shared/api/client";
import {
  getArtInitiationClinicianDetails,
  saveArtInitiationClinicianDetails,
} from "@/shared/api/artInitiationClinicianDetails";
import { getMyClinicianProfile } from "@/shared/api/clinicianProfile";
import { Button } from "@/shared/components/Button";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { SignaturePad } from "@/shared/components/SignaturePad";
import { Modal } from "@/pharmacy/components/Modal";
import { blobToDataUrl } from "@/pharmacy/lib/blobToDataUrl";

interface ClinicianDetailsDraft {
  signatureDataUrl: string | null;
  signatureBlob: Blob | null;
  signatureChanged: boolean;
  clinicianName: string;
  clinicianQualifications: string;
  sancNumber: string;
  hpcsaNumber: string;
}

const EMPTY_DRAFT: ClinicianDetailsDraft = {
  signatureDataUrl: null,
  signatureBlob: null,
  signatureChanged: false,
  clinicianName: "",
  clinicianQualifications: "",
  sancNumber: "",
  hpcsaNumber: "",
};

const inputClass =
  "h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const textareaClass =
  "min-h-28 w-full resize-y rounded-lg border border-border-strong bg-surface-raised px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function formatUpdatedAt(value: string): string {
  return new Date(value).toLocaleString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ArtInitiationClinicianDetailsForm({ visitId }: { visitId: string }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ClinicianDetailsDraft>(EMPTY_DRAFT);
  const [signaturePadKey, setSignaturePadKey] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  const detailsQuery = useQuery({
    queryKey: ["art-initiation-clinician-details", visitId],
    queryFn: () => getArtInitiationClinicianDetails(visitId),
    enabled: open,
  });
  const profileQuery = useQuery({
    queryKey: ["my-clinician-profile"],
    queryFn: getMyClinicianProfile,
    enabled: open,
  });

  useEffect(() => {
    if (!open || detailsQuery.data === undefined || profileQuery.isLoading) return;
    const saved = detailsQuery.data;
    if (saved) {
      setDraft({
        signatureDataUrl: saved.signatureDataUrl,
        signatureBlob: null,
        signatureChanged: false,
        clinicianName: saved.clinicianName ?? "",
        clinicianQualifications: saved.clinicianQualifications ?? "",
        sancNumber: saved.sancNumber ?? "",
        hpcsaNumber: saved.hpcsaNumber ?? "",
      });
      setSignaturePadKey((key) => key + 1);
      return;
    }
    const profile = profileQuery.data;
    setDraft({
      ...EMPTY_DRAFT,
      clinicianName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : "",
      sancNumber: profile?.sancNumber ?? "",
      hpcsaNumber: profile?.hpcsaNumber ?? "",
    });
    setSignaturePadKey((key) => key + 1);
  }, [open, detailsQuery.data, profileQuery.data, profileQuery.isLoading]);

  const save = useMutation({
    mutationFn: async () => {
      const signatureDataUrl = draft.signatureChanged
        ? draft.signatureBlob ? await blobToDataUrl(draft.signatureBlob) : null
        : draft.signatureDataUrl;
      return saveArtInitiationClinicianDetails(visitId, {
        signatureDataUrl,
        clinicianName: draft.clinicianName.trim() || null,
        clinicianQualifications: draft.clinicianQualifications.trim() || null,
        sancNumber: draft.sancNumber.trim() || null,
        hpcsaNumber: draft.hpcsaNumber.trim() || null,
      });
    },
    onSuccess: (details) => {
      queryClient.setQueryData(["art-initiation-clinician-details", visitId], details);
      setSaveError(null);
      setOpen(false);
      showToast("Clinician details saved.", "success");
    },
    onError: (error) => {
      setSaveError(error instanceof ApiError ? error.message : "Couldn't save clinician details. Try again.");
    },
  });

  function updateDraft(patch: Partial<ClinicianDetailsDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveError(null);
  }

  function resetDraft() {
    setDraft({ ...EMPTY_DRAFT, signatureChanged: true });
    setSignaturePadKey((key) => key + 1);
    setSaveError(null);
  }

  const isLoading = detailsQuery.isLoading || profileQuery.isLoading;

  return (
    <>
      <Button
        variant="secondary"
        size="md"
        icon={<BadgeCheck className="size-4" aria-hidden />}
        onClick={() => {
          setSaveError(null);
          setOpen(true);
        }}
      >
        Generate Clinician Details
      </Button>

      <Modal
        open={open}
        size="lg"
        title="Generate Clinician Details"
        description="Capture the clinician's signature, name, qualifications, and registration numbers for this visit."
        dismissible={!save.isPending}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="secondary" disabled={save.isPending || isLoading} onClick={resetDraft}>
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden />
              Reset
            </Button>
            <Button
              variant="primary"
              loading={save.isPending}
              disabled={isLoading || detailsQuery.isError}
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
              <p className="text-[13px] text-danger-700">Couldn't load saved clinician details.</p>
              <Button variant="secondary" size="md" onClick={() => detailsQuery.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {profileQuery.isError && !detailsQuery.isError && !detailsQuery.data && (
            <p role="status" className="rounded-lg bg-warning-50 px-3.5 py-3 text-[13px] text-warning-600">
              Couldn't load your registered details. You can enter your name and registration numbers here.
            </p>
          )}

          {isLoading ? (
            <p className="text-[13px] text-text-secondary">Loading clinician details…</p>
          ) : !detailsQuery.isError ? (
            <>
              {detailsQuery.data && (
                <p className="rounded-lg bg-brand-50 px-3.5 py-3 text-[12.5px] text-brand-800">
                  Clinician details are saved for this visit. Saving changes will update them; Reset clears the form draft.
                  <span className="mt-1 block text-brand-700">
                    Last saved by {detailsQuery.data.updatedByName ?? "Clinical staff"} · {formatUpdatedAt(detailsQuery.data.updatedAt)}
                  </span>
                </p>
              )}

              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Clinician Signature
                <SignaturePad
                  key={signaturePadKey}
                  initialDataUrl={draft.signatureDataUrl}
                  emptyLabel="Draw the clinician's signature here"
                  onChange={(signature) => updateDraft({
                    signatureBlob: signature,
                    signatureChanged: true,
                    ...(signature === null ? { signatureDataUrl: null } : {}),
                  })}
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Clinician Name
                <input
                  className={inputClass}
                  value={draft.clinicianName}
                  maxLength={200}
                  onChange={(event) => updateDraft({ clinicianName: event.target.value })}
                  placeholder="Enter clinician name"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                Clinician Qualifications
                <textarea
                  className={textareaClass}
                  value={draft.clinicianQualifications}
                  maxLength={10_000}
                  onChange={(event) => updateDraft({ clinicianQualifications: event.target.value })}
                  placeholder="Enter clinician qualifications"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  SANC Number
                  <input
                    className={inputClass}
                    value={draft.sancNumber}
                    maxLength={30}
                    onChange={(event) => updateDraft({ sancNumber: event.target.value })}
                    placeholder="Enter SANC number"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-[12.5px] font-medium text-text-primary">
                  HPCSA Number
                  <input
                    className={inputClass}
                    value={draft.hpcsaNumber}
                    maxLength={30}
                    onChange={(event) => updateDraft({ hpcsaNumber: event.target.value })}
                    placeholder="Enter HPCSA number"
                  />
                </label>
              </div>
              {saveError && <p role="alert" className="text-[13px] text-danger-700">{saveError}</p>}
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
