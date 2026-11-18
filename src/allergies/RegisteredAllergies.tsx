import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPatientAllergies, type PatientAllergyRecord } from "@/shared/api/allergies";
import type { AllergyStatus } from "@/shared/api/consultations";
import { activeAllergies, activeMedicationAtcCodes, describeAllergy } from "./allergyLabels";

// The patient's allergy record, made available to everything inside the consultation tab (the draft form, the
// amend form, the prescribing workspace) without threading a patient id through every component between them.

export const allergyQueryKey = (patientId: string) => ["patients", patientId, "allergies"] as const;

interface RegisteredAllergiesValue {
  record: PatientAllergyRecord | undefined;
  /** ATC codes of the active medication allergies on the patient's record. */
  codes: string[];
  isLoading: boolean;
  isError: boolean;
}

const EMPTY: RegisteredAllergiesValue = { record: undefined, codes: [], isLoading: false, isError: false };
const RegisteredAllergiesContext = createContext<RegisteredAllergiesValue>(EMPTY);

export function RegisteredAllergiesProvider({ patientId, children }: { patientId: string; children: ReactNode }) {
  const query = useQuery({ queryKey: allergyQueryKey(patientId), queryFn: () => getPatientAllergies(patientId) });
  const value: RegisteredAllergiesValue = {
    record: query.data,
    codes: activeMedicationAtcCodes(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
  };
  return <RegisteredAllergiesContext.Provider value={value}>{children}</RegisteredAllergiesContext.Provider>;
}

export function useRegisteredAllergies(): RegisteredAllergiesValue {
  return useContext(RegisteredAllergiesContext);
}

/**
 * What the prescribing area shows and enforces: the consultation's own allergy fields and the patient's allergy
 * record together. The codes are merged (so a medicine matching either is blocked); the note says where each
 * warning comes from.
 */
export function usePrescribingAllergies(
  consultationStatus: AllergyStatus,
  consultationNote: string | null,
  consultationCodes: string[],
): { allergyNote: string | null; allergyAtcCodes: string[] } {
  const registered = useRegisteredAllergies();
  const allergyAtcCodes = Array.from(new Set([...consultationCodes, ...registered.codes]));

  const parts: string[] = [];
  if (consultationNote) parts.push(consultationNote);

  const record = registered.record;
  if (record) {
    const active = activeAllergies(record);
    if (active.length > 0) {
      const blocking = registered.codes.length > 0 ? " Medicines sharing the first five ATC characters are blocked." : "";
      parts.push(`Patient allergy record: ${active.map(describeAllergy).join(", ")}.${blocking}`);
    } else if (record.status === "UNKNOWN" && consultationStatus === "UNKNOWN") {
      parts.push("Allergy status is unknown for this patient. Ask the patient and record it on the Allergies page.");
    }
  } else if (registered.isError) {
    parts.push("The patient's allergy record could not be loaded. Check allergies before prescribing.");
  }

  return { allergyNote: parts.length > 0 ? parts.join(" ") : null, allergyAtcCodes };
}