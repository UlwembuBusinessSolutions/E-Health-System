import type { TriageColour } from "@/shared/api/triage";

// A dedicated badge rather than reusing StatusPill's success/warning/
// danger/neutral tones: SATS's four colours are a specific clinical
// severity scale, not a generic record-state indicator, and a clinician
// scanning a waiting room expects "Orange" to actually look orange, not
// share a tone with "Yellow" the way StatusPill's four generic tones
// would force it to.
// -600, not -700: index.css's @theme only defines success/danger/amber up
// to -600 (unlike brand, which has a full 50-900 scale) — a -700 variant
// on any of those three doesn't exist and Tailwind silently generates no
// utility for it, leaving the text colour unset. orange is untouched by
// this app's theme at all, so its full default Tailwind scale (including
// -700) applies normally.
const STYLES: Record<TriageColour, string> = {
  GREEN: "border-success-500/40 bg-success-50 text-success-600",
  YELLOW: "border-amber-500/40 bg-amber-50 text-amber-600",
  ORANGE: "border-orange-500/40 bg-orange-50 text-orange-700",
  RED: "border-danger-500/40 bg-danger-50 text-danger-600",
};

const LABELS: Record<TriageColour, string> = {
  GREEN: "Green",
  YELLOW: "Yellow",
  ORANGE: "Orange",
  RED: "Red",
};

export function TriageColourBadge({ colour }: { colour: TriageColour }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${STYLES[colour]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {LABELS[colour]}
    </span>
  );
}
