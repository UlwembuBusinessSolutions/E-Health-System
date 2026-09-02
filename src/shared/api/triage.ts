import { apiClient } from "@/shared/api/client";
import { tenantAuthHeaders } from "@/shared/api/auth";

// Types aligned with backend
export type AvpuLevel = "ALERT" | "VOICE" | "PAIN" | "UNRESPONSIVE";

export interface VitalSigns {
  id: string;
  visitId: string;
  patientId: string;
  systolicBloodPressure: number;
  diastolicBloodPressure: number;
  heartRate: number;
  temperatureCelsius: string; // BigDecimal from backend
  respiratoryRate: number;
  avpu: AvpuLevel;
  capturedAt: string; // ISO 8601 Instant
  capturedByUserId: string;
}

export interface CaptureVitalsPayload {
  systolicBloodPressure: number;
  diastolicBloodPressure: number;
  heartRate: number;
  temperatureCelsius: string;
  respiratoryRate: number;
  avpu: AvpuLevel;
  confirmOutOfRange: boolean;
}

export interface CaptureVitalsResponse {
  assessment: VitalSigns;
  priorAssessment: VitalSigns | null;
}

// Vital signs ranges for validation (client-side)
export const VITAL_RANGES = {
  systolicBP: {
    min: 40,
    max: 300,
    normal: { min: 90, max: 180 },
    unit: "mmHg",
  },
  diastolicBP: {
    min: 20,
    max: 200,
    normal: { min: 60, max: 120 },
    unit: "mmHg",
  },
  heartRate: {
    min: 20,
    max: 250,
    normal: { min: 50, max: 120 },
    unit: "bpm",
  },
  temperature: {
    min: 30.0,
    max: 45.0,
    normal: { min: 35.0, max: 38.0 },
    unit: "°C",
  },
  respiratoryRate: {
    min: 5,
    max: 80,
    normal: { min: 12, max: 20 },
    unit: "breaths/min",
  },
};

/**
 * Capture vital signs for a visit (triage assessment)
 * POST /api/v1/visits/{visitId}/triage-assessments
 */
export async function captureVitals(
  visitId: string,
  payload: CaptureVitalsPayload
): Promise<CaptureVitalsResponse> {
  return apiClient.post<CaptureVitalsResponse>(
    `/api/v1/visits/${visitId}/triage-assessments`,
    payload,
    { headers: tenantAuthHeaders() }
  );
}

/**
 * Validate vital signs against clinically plausible ranges
 * Returns errors if values are outside acceptable ranges
 */
export function validateVitalSigns(
  vitals: Partial<CaptureVitalsPayload>
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (vitals.systolicBloodPressure !== undefined) {
    const sys = vitals.systolicBloodPressure;
    if (sys < VITAL_RANGES.systolicBP.min || sys > VITAL_RANGES.systolicBP.max) {
      errors.systolicBloodPressure = `Must be between ${VITAL_RANGES.systolicBP.min} and ${VITAL_RANGES.systolicBP.max} ${VITAL_RANGES.systolicBP.unit}`;
    }
  }

  if (vitals.diastolicBloodPressure !== undefined) {
    const dia = vitals.diastolicBloodPressure;
    if (dia < VITAL_RANGES.diastolicBP.min || dia > VITAL_RANGES.diastolicBP.max) {
      errors.diastolicBloodPressure = `Must be between ${VITAL_RANGES.diastolicBP.min} and ${VITAL_RANGES.diastolicBP.max} ${VITAL_RANGES.diastolicBP.unit}`;
    }
  }

  if (
    vitals.systolicBloodPressure !== undefined &&
    vitals.diastolicBloodPressure !== undefined
  ) {
    if (vitals.diastolicBloodPressure >= vitals.systolicBloodPressure) {
      errors.diastolicBloodPressure =
        "Must be lower than systolic blood pressure";
    }
  }

  if (vitals.heartRate !== undefined) {
    const hr = vitals.heartRate;
    if (hr < VITAL_RANGES.heartRate.min || hr > VITAL_RANGES.heartRate.max) {
      errors.heartRate = `Must be between ${VITAL_RANGES.heartRate.min} and ${VITAL_RANGES.heartRate.max} ${VITAL_RANGES.heartRate.unit}`;
    }
  }

  if (vitals.temperatureCelsius !== undefined) {
    const temp = parseFloat(vitals.temperatureCelsius);
    if (
      isNaN(temp) ||
      temp < VITAL_RANGES.temperature.min ||
      temp > VITAL_RANGES.temperature.max
    ) {
      errors.temperatureCelsius = `Must be between ${VITAL_RANGES.temperature.min} and ${VITAL_RANGES.temperature.max} ${VITAL_RANGES.temperature.unit}`;
    }
  }

  if (vitals.respiratoryRate !== undefined) {
    const rr = vitals.respiratoryRate;
    if (
      rr < VITAL_RANGES.respiratoryRate.min ||
      rr > VITAL_RANGES.respiratoryRate.max
    ) {
      errors.respiratoryRate = `Must be between ${VITAL_RANGES.respiratoryRate.min} and ${VITAL_RANGES.respiratoryRate.max} ${VITAL_RANGES.respiratoryRate.unit}`;
    }
  }

  return errors;
}

/**
 * Check if vital signs are abnormal but plausible
 * Returns true if any vital is outside normal ranges
 */
export function isAbnormal(vitals: CaptureVitalsPayload): boolean {
  const sys = vitals.systolicBloodPressure;
  const dia = vitals.diastolicBloodPressure;
  const hr = vitals.heartRate;
  const temp = parseFloat(vitals.temperatureCelsius);
  const rr = vitals.respiratoryRate;

  return (
    sys < VITAL_RANGES.systolicBP.normal.min ||
    sys > VITAL_RANGES.systolicBP.normal.max ||
    dia < VITAL_RANGES.diastolicBP.normal.min ||
    dia > VITAL_RANGES.diastolicBP.normal.max ||
    hr < VITAL_RANGES.heartRate.normal.min ||
    hr > VITAL_RANGES.heartRate.normal.max ||
    temp < VITAL_RANGES.temperature.normal.min ||
    temp > VITAL_RANGES.temperature.normal.max ||
    rr < VITAL_RANGES.respiratoryRate.normal.min ||
    rr > VITAL_RANGES.respiratoryRate.normal.max ||
    vitals.avpu !== "ALERT"
  );
}

/**
 * Format vital signs for display
 */
export function formatVitals(vitals: VitalSigns): Record<string, string> {
  return {
    systolicBP: `${vitals.systolicBloodPressure} mmHg`,
    diastolicBP: `${vitals.diastolicBloodPressure} mmHg`,
    bloodPressure: `${vitals.systolicBloodPressure}/${vitals.diastolicBloodPressure} mmHg`,
    heartRate: `${vitals.heartRate} bpm`,
    temperature: `${vitals.temperatureCelsius} °C`,
    respiratoryRate: `${vitals.respiratoryRate} breaths/min`,
    avpu: vitals.avpu,
    capturedAt: new Date(vitals.capturedAt).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
