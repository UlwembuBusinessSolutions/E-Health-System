// The "Vital Signs" user story rules, as pure functions, for the live preview while the nurse types.
//
// This file mirrors backend triage/VitalsClassifier.java rule for rule: the backend classifies the saved
// record, this classifies the form before it is saved, and they must never disagree. If a rule changes,
// change both. Every classification can be shown in brackets, e.g. "(Fever)", as the story asks.
//
// STORY GAP notes match the ones in VitalsClassifier.java.

export type ClassificationTone = "normal" | "attention" | "intervention";

export interface Classification {
  label: string;
  /** The label in brackets, e.g. "(Normal)". What the screen shows. */
  text: string;
  tone: ClassificationTone;
  /** ICD-10 codes this result points to, for prescribing. */
  icd10: string[];
  interventionRequired: boolean;
  referToDietician: boolean;
}

export const HYPOGLYCEMIA_CODES = ["E10.0", "E11.0", "E12.0", "E13.0", "E14.0"];
export const DIABETES_CODES = ["E10.9", "E11.9"];
export const HYPERTENSION_CODE = "I10";

/**
 * STORY GAP: the story says only "pH above 7 requires intervention" for urinalysis. By default any other
 * abnormal dipstick result is "(Abnormal)" for review. Set to true to make each one require intervention.
 * Keep equal to VitalsClassifier.ANY_ABNORMAL_URINE_REQUIRES_INTERVENTION.
 */
export const ANY_ABNORMAL_URINE_REQUIRES_INTERVENTION = false;

function make(
  label: string,
  tone: ClassificationTone,
  extra: Partial<Pick<Classification, "icd10" | "interventionRequired" | "referToDietician">> = {},
): Classification {
  return {
    label,
    text: `(${label})`,
    tone,
    icd10: extra.icd10 ?? [],
    interventionRequired: extra.interventionRequired ?? tone === "intervention",
    referToDietician: extra.referToDietician ?? false,
  };
}

/** Whole months between a date of birth (yyyy-mm-dd) and a day, the way the backend counts them. */
export function ageInMonths(dateOfBirth: string | null | undefined, on: Date = new Date()): number | null {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  let months = (on.getFullYear() - year) * 12 + (on.getMonth() + 1 - month);
  if (on.getDate() < day) months -= 1;
  return months < 0 ? null : months;
}

const number = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// 1. Body temperature -------------------------------------------------------------------------

/** Older than 5 years: fever above 37.6. 0 to 5 years: fever above 37.5. Exactly 5 years is in the 0-5 group. */
export function classifyTemperature(celsius: string | number | null, ageMonths: number | null): Classification | null {
  const value = number(celsius);
  if (value === null || ageMonths === null) return null;
  const limit = ageMonths > 60 ? 37.6 : 37.5;
  return value > limit ? make("Fever", "attention") : make("Normal", "normal");
}

// 2. Respiration rate -------------------------------------------------------------------------

function between(value: number, low: number, high: number): Classification {
  return value >= low && value <= high ? make("Normal", "normal") : make("Outside normal range", "attention");
}

export function classifyRespiration(rate: string | number | null, ageMonths: number | null): Classification | null {
  const value = number(rate);
  if (value === null || ageMonths === null) return null;
  if (ageMonths < 2) return between(value, 30, 60);
  if (ageMonths < 12) return value > 50 ? make("Having fast breathing", "attention") : make("Normal", "normal");
  if (ageMonths < 60) return value > 40 ? make("Having fast breathing", "attention") : make("Normal", "normal");
  if (ageMonths < 120) return between(value, 15, 27);
  return between(value, 12, 20);
}

// 3. Blood pressure ---------------------------------------------------------------------------

/** From age 18. When systolic and diastolic fall in different bands the higher band applies. */
export function classifyBloodPressure(
  systolic: string | number | null,
  diastolic: string | number | null,
  ageMonths: number | null,
): Classification | null {
  const sys = number(systolic);
  const dia = number(diastolic);
  if (sys === null || dia === null || ageMonths === null || ageMonths < 216) return null;
  const icd10 = [HYPERTENSION_CODE];
  if (sys >= 180 || dia >= 110) return make("Severe Hypertension – Medicine adjustment required", "intervention", { icd10, interventionRequired: true });
  if (sys >= 160 || dia >= 100) return make("Moderate Hypertension – Medicine adjustment required", "intervention", { icd10, interventionRequired: true });
  if (sys >= 140 || dia >= 90) return make("Mild Hypertension – Medicine adjustment required", "attention", { icd10, interventionRequired: true });
  // STORY GAP: low readings are not in the story; flagged for review instead of labelled normal.
  if (sys < 90 || dia < 60) return make("Low – review", "attention");
  return make("Normal", "normal");
}

// 4. Urinalysis -------------------------------------------------------------------------------

/** Blood, urobilinogen, bilirubin, glucose, leukocytes, protein, nitrate, ketones. */
export function classifyUrineDipstick(value: string | null | undefined): Classification | null {
  if (!value) return null;
  if (value === "NEGATIVE" || value === "NORMAL") return make("Normal", "normal");
  return ANY_ABNORMAL_URINE_REQUIRES_INTERVENTION ? make("Intervention Required", "intervention") : make("Abnormal", "attention");
}

/** pH above 7 requires intervention. */
export function classifyUrinePh(ph: string | number | null): Classification | null {
  const value = number(ph);
  if (value === null) return null;
  return value > 7 ? make("Intervention Required", "intervention") : make("Normal", "normal");
}

// 5. Blood glucose ----------------------------------------------------------------------------

/**
 * Below 4 is hypoglycemia, above 11.1 is hyperglycemia, whatever the type. Between them the type
 * (fasting or random) decides; without it nothing is classified.
 * STORY GAP: fasting 7.0 to 11.1, or random of exactly 11.1, is "Elevated – review".
 */
export function classifyGlucose(mmol: string | number | null, type: string | null | undefined): Classification | null {
  const value = number(mmol);
  if (value === null) return null;
  if (value < 4) return make("Hypoglycemia – intervention required", "intervention", { icd10: HYPOGLYCEMIA_CODES, interventionRequired: true });
  if (value > 11.1) return make("Hyperglycemia – Intervention", "intervention", { icd10: DIABETES_CODES, interventionRequired: true });
  if (type === "FASTING") {
    return value < 7.0
      ? make("Normal", "normal", { icd10: DIABETES_CODES })
      : make("Elevated – review", "attention", { icd10: DIABETES_CODES, interventionRequired: false });
  }
  if (type === "RANDOM") {
    return value < 11.1
      ? make("Normal", "normal", { icd10: DIABETES_CODES })
      : make("Elevated – review", "attention", { icd10: DIABETES_CODES, interventionRequired: false });
  }
  return null;
}

// 6 to 9. Weight, height, BMI -----------------------------------------------------------------

/** Height as centimetres, from a value typed in centimetres or metres. */
export function heightInCm(value: string | number | null, unit: string | null | undefined): number | null {
  const height = number(value);
  if (height === null || height <= 0) return null;
  const cm = unit === "m" ? height * 100 : height;
  return Math.round(cm * 100) / 100;
}

/** Weight in kg divided by height in metres squared, to one decimal. */
export function bodyMassIndex(weightKg: string | number | null, heightCentimetres: number | null): number | null {
  const weight = number(weightKg);
  if (weight === null || weight <= 0 || heightCentimetres === null || heightCentimetres <= 0) return null;
  const metres = heightCentimetres / 100;
  return Math.round((weight / (metres * metres)) * 10) / 10;
}

/** The story's ranges meet at 25, so exactly 25.0 is Overweight. */
export function classifyBmi(bmi: number | null): Classification | null {
  if (bmi === null) return null;
  const refer = { interventionRequired: true, referToDietician: true };
  if (bmi < 18.5) return make("Underweight – Intervention is required, and refer to Dietician", "attention", refer);
  if (bmi < 25.0) return make("Normal", "normal");
  if (bmi < 30.0) return make("Overweight – Intervention is required, and refer to Dietician", "attention", refer);
  return make("Obese – Intervention is required, and refer to Dietician", "attention", refer);
}

/** Distinct ICD-10 codes across several results, in order. */
export function icd10CodesOf(results: Array<Classification | null | undefined>): string[] {
  const codes: string[] = [];
  for (const result of results) {
    for (const code of result?.icd10 ?? []) if (!codes.includes(code)) codes.push(code);
  }
  return codes;
}

/** Tailwind classes for the result pill, using the colours the rest of the app already has. */
export const CLASSIFICATION_PILL: Record<ClassificationTone, string> = {
  normal: "bg-[#d7e4e1] text-[#54766f]",
  attention: "bg-amber-100 text-amber-800",
  intervention: "bg-[#dc2f3f] text-white",
};
