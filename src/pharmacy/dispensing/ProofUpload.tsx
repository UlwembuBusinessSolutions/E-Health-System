import { useId, useRef, useState, type ChangeEvent } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/shared/components/Button";

interface ProofUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
}

const MAX_BYTES = 10 * 1024 * 1024;

function describeSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// PhotoCapture is built around round headshots, but written authorisation is
// usually a PDF or a phone photo of a letter, so this is a plain file input.
// `accept` with image/* also offers the camera on phones.
export function ProofUpload({ file, onChange }: ProofUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (selected.size > MAX_BYTES) {
      setError("That file is over 10 MB. Choose a smaller file or a lower-resolution photo.");
      return;
    }
    setError(null);
    onChange(selected);
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        className="sr-only"
        aria-label="Proof of authorisation file"
        aria-describedby={error ? errorId : undefined}
        tabIndex={-1}
        onChange={handleChange}
      />
      {file ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border-strong bg-surface-sunken/60 px-3.5 py-2">
          <span className="flex min-w-0 items-center gap-2 text-[14px] text-text-primary">
            <FileText className="size-4 shrink-0 text-text-secondary" aria-hidden />
            <span className="truncate">{file.name}</span>
            <span className="shrink-0 text-[12.5px] text-text-secondary">{describeSize(file.size)}</span>
          </span>
          <button
            type="button"
            aria-label="Remove proof of authorisation"
            onClick={() => onChange(null)}
            className="grid size-11 shrink-0 place-items-center rounded-lg text-text-secondary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          icon={<Upload className="size-4" aria-hidden />}
          onClick={() => inputRef.current?.click()}
        >
          Upload or take a photo
        </Button>
      )}
      <p className="text-[13px] text-text-secondary">PDF, JPG or PNG, up to 10 MB.</p>
      {error && (
        <p id={errorId} role="alert" className="text-[13px] text-danger-500">
          {error}
        </p>
      )}
    </div>
  );
}
