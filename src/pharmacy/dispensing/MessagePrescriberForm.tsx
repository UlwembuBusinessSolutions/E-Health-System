import { useState } from "react";
import { InlinePanel } from "./InlinePanel";
import { TextAreaField } from "./TextAreaField";

interface MessagePrescriberFormProps {
  prescriberName: string | null;
  /** Prefilled for a substitute request; empty for a free-form question. */
  initialText: string;
  loading: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export function MessagePrescriberForm({
  prescriberName,
  initialText,
  loading,
  onSend,
  onCancel,
}: MessagePrescriberFormProps) {
  const [text, setText] = useState(initialText);
  const trimmed = text.trim();

  return (
    <InlinePanel
      title="Message the prescriber"
      confirmLabel="Send email"
      confirmDisabled={trimmed === ""}
      loading={loading}
      onConfirm={() => onSend(trimmed)}
      onCancel={onCancel}
    >
      <TextAreaField
        label={`Message to ${prescriberName ?? "the prescriber"}`}
        placeholder="e.g. Dosage seems high for this patient's weight. Please confirm before I dispense."
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </InlinePanel>
  );
}
