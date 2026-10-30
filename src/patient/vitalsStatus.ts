import type { ScoringProfile, TriageAssessment } from "@/shared/api/triage";

// ONE place for the reference ranges behind the status pills on the vitals
// dashboard ("Optimal ✓", "Low", "Critical", "High-intensity", …) and for what
// counts as a "sub-optimal" reading in the Overview card.
//
// IMPORTANT — these are adult screening ranges only. Children's ranges depend
// on age, so for any non-ADULT scoring profile the numeric helpers return null
// (no pill) rather than show a wrong one. Have your clinical lead confirm the
// numbers below before relying on them; changing a threshold here changes it
// everywhere (cards, tiles and the Overview counts).

export type StatusTone = "optimal" | "caution" | "critical";
export interface VitalStatus {
  tone: StatusTone;
  label: string;
}

const optimal = (label = "Optimal"): VitalStatus => ({ tone: "optimal", label });
const caution = (label: string): VitalStatus => ({ tone: "caution", label });
const critical = (label: string): VitalStatus => ({ tone: "critical", label });
const isAdult = (profile: ScoringProfile | null | undefined) => profile === "ADULT";

/** True when the backend's own "confirmed unusual measurements" text mentions this measurement. */
export function isWarned(assessment: TriageAssessment, pattern: RegExp): boolean {
  return !!assessment.validationWarnings && pattern.test(assessment.validationWarnings);
}

export function heartRateStatus(bpm: number | null, profile: ScoringProfile): VitalStatus | null {
  if (bpm == null || !isAdult(profile)) return null;
  if (bpm <= 40 || bpm > 110) return critical(bpm <= 40 ? "Low" : "High");
  if (bpm <= 50) return caution("Low");
  if (bpm > 100) return caution("High");
  return optimal();
}

export function bloodPressureStatus(
  systolic: number | null,
  diastolic: number | null,
  profile: ScoringProfile,
  warnedByBackend: boolean,
): VitalStatus | null {
  if (systolic == null) return null;
  if (warnedByBackend) return critical("Critical");
  if (!isAdult(profile)) return null;
  if (systolic < 90 || systolic >= 180 || (diastolic ?? 0) >= 110) return critical("Critical");
  if (systolic < 100) return caution("Low");
  if (systolic >= 140 || (diastolic ?? 0) >= 90) return caution("High");
  return optimal();
}

export function spo2Status(percent: number | null, profile: ScoringProfile, warnedByBackend: boolean): VitalStatus | null {
  if (percent == null) return null;
  if (warnedByBackend || (isAdult(profile) && percent < 90)) return critical("Low");
  if (!isAdult(profile)) return null;
  if (percent < 94) return caution("Low");
  return optimal();
}

export function painStatus(score: number | null): VitalStatus | null {
  if (score == null) return null;
  if (score >= 7) return critical("High-intensity");
  if (score >= 4) return caution("Moderate");
  return null;
}

export function traumaStatus(present: boolean | null | undefined): VitalStatus | null {
  if (present == null) return null;
  return present ? critical("Trauma") : optimal("Normal");
}

// WHO adult BMI categories.
export function bmiStatus(bmi: number | null | undefined, profile: ScoringProfile | null | undefined): VitalStatus | null {
  if (bmi == null || !isAdult(profile)) return null;
  if (bmi < 16) return critical("Severely underweight");
  if (bmi < 18.5) return caution("Underweight");
  if (bmi < 25) return optimal();
  if (bmi < 30) return caution("Overweight");
  return caution("Obese");
}

// Adult haemoglobin, sexes combined (g/dL). Sex-specific ranges differ
// (about 13–17 men, 12–15.5 women); this uses the wider, safer window.
export function haemoglobinStatus(gdl: number | null | undefined, profile: ScoringProfile | null | undefined): VitalStatus | null {
  if (gdl == null || !isAdult(profile)) return null;
  if (gdl < 8) return critical("Low");
  if (gdl < 12) return caution("Low");
  if (gdl > 17.5) return caution("High");
  return optimal("Normal");
}

/**
 * A reading is "sub-optimal" when its triage colour isn't green, the backend
 * flagged unusual measurements, or one of the dashboard vitals is critical.
 * Drives the pink bars and the Optimal / Sub Optimal counts in Overview.
 */
export function isSubOptimalReading(reading: TriageAssessment): boolean {
  if (reading.finalColour !== "GREEN") return true;
  if (reading.outOfRangeConfirmed && !!reading.validationWarnings) return true;
  const statuses = [
    heartRateStatus(reading.heartRate, reading.scoringProfile),
    bloodPressureStatus(reading.systolicBp, reading.diastolicBp, reading.scoringProfile, isWarned(reading, /blood pressure|systolic|diastolic/i)),
    spo2Status(reading.spo2Percent, reading.scoringProfile, isWarned(reading, /spo|oxygen saturation/i)),
    painStatus(reading.painScore),
  ];
  return statuses.some((status) => status?.tone === "critical");
}
