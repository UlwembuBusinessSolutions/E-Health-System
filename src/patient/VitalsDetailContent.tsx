import { AdditionalVitalsSummary } from "./AdditionalVitals";
import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  Clock,
  Eye,
  Footprints,
  Gauge,
  HeartPulse,
  History,
  ShieldAlert,
  Stethoscope,
  Thermometer,
  TriangleAlert,
  User,
  Wind,
} from "lucide-react";
import type {
  Avpu,
  Mobility,
  OxygenSupport,
  ScoringProfile,
  TriageAssessment,
  TriageColour,
  TriageDiscriminator,
} from "@/shared/api/triage";
import { TriageColourBadge } from "@/shared/components/TriageColourBadge";

// Shared label vocabulary for a captured vitals/triage reading — used by
// both the capture form (PatientDetailPage) and this read-only detail view,
// so a value picked in the form and a value shown back here never drift
// into two different wordings for the same thing.
export const AVPU_OPTIONS: { value: Avpu; label: string }[] = [
  { value: "ALERT", label: "Alert" },
  { value: "CONFUSED", label: "Confused" },
  { value: "VOICE", label: "Responds to voice" },
  { value: "PAIN", label: "Responds to pain" },
  { value: "UNRESPONSIVE", label: "Unresponsive" },
];

export const MOBILITY_OPTIONS: { value: Mobility; label: string }[] = [
  { value: "WALKING", label: "Walking" },
  { value: "MOBILE_WITH_ASSISTANCE", label: "Mobile with assistance" },
  { value: "IMMOBILE", label: "Immobile" },
];

export const OXYGEN_SUPPORT_OPTIONS: { value: OxygenSupport; label: string }[] = [
  { value: "ROOM_AIR", label: "Room air" },
  { value: "SUPPLEMENTAL", label: "Supplemental oxygen" },
];

// Blank first option lets the nurse leave this to the automatic
// age-derived profile (TriageService.deriveScoringProfile()) — only sent
// to the backend when explicitly chosen.
export const SCORING_PROFILE_OPTIONS: { value: ScoringProfile | ""; label: string }[] = [
  { value: "", label: "Auto-detect from date of birth" },
  { value: "ADULT", label: "Adult" },
  { value: "PAEDIATRIC_OLDER_CHILD", label: "Child (older)" },
  { value: "PAEDIATRIC_YOUNGER_CHILD", label: "Child (younger / infant)" },
];

export const TRIAGE_COLOUR_OPTIONS: { value: TriageColour | ""; label: string }[] = [
  { value: "", label: "Select final colour" },
  { value: "GREEN", label: "Green" },
  { value: "YELLOW", label: "Yellow" },
  { value: "ORANGE", label: "Orange" },
  { value: "RED", label: "Red" },
];

// A small, representative starter set, not the exhaustive licensed SATS
// discriminator list — TriageDiscriminator.java's own why-note.
export const DISCRIMINATOR_OPTIONS: { value: TriageDiscriminator; label: string }[] = [
  { value: "CHEST_PAIN", label: "Chest pain" },
  { value: "DIFFICULTY_BREATHING", label: "Difficulty breathing" },
  { value: "ACTIVE_BLEEDING", label: "Active bleeding" },
  { value: "SUSPECTED_STROKE", label: "Suspected stroke" },
  { value: "ALTERED_MENTAL_STATUS", label: "Altered mental status" },
  { value: "SEVERE_PAIN", label: "Severe pain" },
  { value: "SUSPECTED_FRACTURE", label: "Suspected fracture" },
  { value: "SEVERE_DEHYDRATION", label: "Severe dehydration" },
  { value: "PREGNANCY_COMPLICATION", label: "Pregnancy complication" },
  { value: "OTHER", label: "Other" },
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

export function VitalField({
  icon: Icon,
  label,
  value,
  unit,
  caption,
}: {
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
  unit?: string;
  caption?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface-sunken/40 p-3">
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {Icon && <Icon className="size-3" aria-hidden />}
        {label}
      </span>
      <span className="text-[15px] font-semibold text-text-primary">
        {value}
        {unit && <span className="text-[12px] font-medium text-text-secondary">{unit}</span>}
      </span>
      {caption && <span className="text-[11.5px] text-text-secondary">{caption}</span>}
    </div>
  );
}

// The full record behind one captured vitals/triage reading — shared by
// VitalsDetailModal (an on-screen dialog) and VitalsPrintPage (a standalone
// printable page), so what a nurse sees on screen and what ends up on paper
// never drift apart. `headerAction` is the one thing that differs between
// those two hosts — a close button for the modal, nothing for print — so it
// stays a slot the caller fills rather than something this component knows
// about.
export function VitalsDetailContent({
  assessment,
  capturedByName,
  patientName,
  patientMpi,
  headerAction,
}: {
  assessment: TriageAssessment;
  capturedByName?: string | null;
  patientName?: string;
  patientMpi?: string;
  headerAction?: ReactNode;
}) {
  const overridden = !!assessment.overrideReason;
  const scoringProfileLabel =
    SCORING_PROFILE_OPTIONS.find((o) => o.value === assessment.scoringProfile)?.label ?? assessment.scoringProfile;
  const calculatedColourLabel =
    TRIAGE_COLOUR_OPTIONS.find((o) => o.value === assessment.calculatedColour)?.label ?? assessment.calculatedColour;
  const oxygenCaption =
    assessment.oxygenSupport === "SUPPLEMENTAL"
      ? [assessment.oxygenDevice, assessment.oxygenFlowLpm != null ? `${assessment.oxygenFlowLpm} L/min` : null]
          .filter(Boolean)
          .join(" · ") || undefined
      : undefined;

  return (
    <div className="flex flex-col gap-5">
      {(patientName || patientMpi) && (
        <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-3">
          <span className="text-[15px] font-semibold text-text-primary">{patientName}</span>
          {patientMpi && <span className="font-mono text-[12.5px] text-text-secondary">{patientMpi}</span>}
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {overridden ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-sunken px-2.5 py-1 text-[11.5px] font-semibold text-text-secondary line-through opacity-75">
                  Calculated: {calculatedColourLabel}
                </span>
                <span className="text-text-secondary" aria-hidden>
                  &rarr;
                </span>
                <TriageColourBadge colour={assessment.finalColour} />
              </>
            ) : (
              <TriageColourBadge colour={assessment.finalColour} />
            )}
            {!assessment.emergencySign && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-[12px] font-semibold text-ink-600">
                <Activity className="size-3" aria-hidden />
                TEWS {assessment.tewsScore ?? "—"} &middot; {scoringProfileLabel}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-[19px] font-semibold text-text-primary">{formatDateTime(assessment.observedAt)}</h2>
            {capturedByName && (
              <div className="mt-1 flex items-center gap-1.5 text-text-secondary">
                <User className="size-3.5" aria-hidden />
                <span className="text-[13.5px]">Captured by {capturedByName}</span>
              </div>
            )}
          </div>
        </div>
        {headerAction}
      </div>

      {assessment.scoringVersion.includes("DRAFT") && <p role="note" className="rounded-lg bg-warning-50 p-3 text-xs text-text-primary">Draft triage decision support. Clinical validation is required before production use.</p>}
      {assessment.status !== "ACTIVE" && (
        <div className="flex gap-3 rounded-2xl border border-border-strong bg-surface-sunken px-4 py-3.5">
          <History className="size-5 shrink-0 text-text-secondary" aria-hidden />
          <div>
            <p className="text-[13.5px] font-semibold text-text-primary">
              {assessment.status === "SUPERSEDED" ? "Superseded by a later correction" : "Entered in error"}
            </p>
            {assessment.correctionReason && (
              <p className="mt-0.5 text-[13.5px] text-text-secondary">{assessment.correctionReason}</p>
            )}
          </div>
        </div>
      )}

      {assessment.emergencySign && (
        <div className="flex gap-3 rounded-2xl border border-critical-500/30 bg-critical-50 px-4 py-3.5">
          <TriangleAlert className="size-5 shrink-0 text-critical-600" aria-hidden />
          <div>
            <p className="text-[13.5px] font-semibold text-critical-600">Emergency sign observed</p>
            {assessment.emergencySignNote && (
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-text-primary">{assessment.emergencySignNote}</p>
            )}
            <p className="mt-1 text-[12.5px] text-text-secondary">
              Full vitals were not required &mdash; emergency care took priority.
            </p>
          </div>
        </div>
      )}

      {overridden && (
        <div className="flex gap-3 rounded-2xl border border-warning-500/30 bg-warning-50 px-4 py-3.5">
          <ShieldAlert className="size-5 shrink-0 text-warning-600" aria-hidden />
          <div>
            <p className="text-[13.5px] font-semibold text-warning-600">Colour manually overridden</p>
            {assessment.overrideReason && (
              <p className="mt-0.5 text-[13.5px] leading-relaxed text-text-primary">{assessment.overrideReason}</p>
            )}
          </div>
        </div>
      )}

      {assessment.outOfRangeConfirmed && assessment.validationWarnings && (
        <div className="flex gap-3 rounded-2xl border border-warning-500/30 bg-warning-50 px-4 py-3.5">
          <TriangleAlert className="size-5 shrink-0 text-warning-600" aria-hidden />
          <div>
            <p className="text-[13.5px] font-semibold text-warning-600">Confirmed unusual measurements</p>
            <p className="mt-0.5 text-[13.5px] leading-relaxed text-text-primary">{assessment.validationWarnings}</p>
          </div>
        </div>
      )}

      {(
        <div>
          <div className="mb-3.5 flex items-center gap-2 text-text-accent">
            <HeartPulse className="size-[18px]" aria-hidden />
            <span className="text-[13.5px] font-semibold text-text-primary">Vitals</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-4">
            {assessment.respiratoryRate != null && (
              <VitalField icon={Wind} label="Resp. rate" value={String(assessment.respiratoryRate)} unit=" /min" />
            )}
            {assessment.heartRate != null && (
              <VitalField icon={HeartPulse} label="Heart rate" value={String(assessment.heartRate)} unit=" bpm" />
            )}
            {assessment.systolicBp != null && (
              <VitalField
                icon={Gauge}
                label="Blood pressure"
                value={`${assessment.systolicBp}${assessment.diastolicBp != null ? `/${assessment.diastolicBp}` : ""}`}
                unit=" mmHg"
              />
            )}
            {assessment.temperatureCelsius != null && (
              <VitalField icon={Thermometer} label="Temp" value={String(assessment.temperatureCelsius)} unit="°C" />
            )}
            {assessment.spo2Percent != null && (
              <VitalField icon={Activity} label="SpO2" value={String(assessment.spo2Percent)} unit="%" />
            )}
            {assessment.avpu && (
              <VitalField
                icon={Eye}
                label="AVPU"
                value={AVPU_OPTIONS.find((o) => o.value === assessment.avpu)?.label ?? assessment.avpu}
              />
            )}
            {assessment.mobility && (
              <VitalField
                icon={Footprints}
                label="Mobility"
                value={MOBILITY_OPTIONS.find((o) => o.value === assessment.mobility)?.label ?? assessment.mobility}
              />
            )}
            <VitalField
              icon={Wind}
              label="Oxygen"
              value={assessment.oxygenSupport === "SUPPLEMENTAL" ? "Supplemental" : "Room air"}
              caption={oxygenCaption}
            />
            {assessment.painScore != null && (
              <VitalField
                icon={Gauge}
                label="Pain"
                value={String(assessment.painScore)}
                unit=" / 10"
                caption={assessment.painScale ?? undefined}
              />
            )}
          </div>
        </div>
      )}

      <AdditionalVitalsSummary value={assessment.additionalObservations} />
      {assessment.presentingComplaint && (
        <div className="border-t border-border-subtle pt-4">
          <div className="mb-2 flex items-center gap-2 text-text-accent">
            <Stethoscope className="size-4" aria-hidden />
            <span className="text-[13.5px] font-semibold text-text-primary">Presenting complaint</span>
          </div>
          <p className="text-[13.5px] leading-relaxed text-text-primary">{assessment.presentingComplaint}</p>
        </div>
      )}

      {assessment.discriminators.length > 0 && (
        <div className={assessment.presentingComplaint ? "" : "border-t border-border-subtle pt-4"}>
          <div className="flex flex-wrap gap-2">
            {assessment.discriminators.map((d) => (
              <span key={d} className="rounded-full bg-ink-100 px-3 py-1.5 text-[12.5px] font-medium text-ink-600">
                {DISCRIMINATOR_OPTIONS.find((o) => o.value === d)?.label ?? d}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 border-t border-border-subtle pt-4 text-text-secondary">
        <Clock className="size-[13px]" aria-hidden />
        <span className="text-[12px]">Saved to the record {formatDateTime(assessment.recordedAt)}</span>
      </div>
    </div>
  );
}
