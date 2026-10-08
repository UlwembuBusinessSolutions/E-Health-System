import type { ConsultationOutcome } from "@/shared/api/consultations";

// What happened at the end of a signed consultation, in words that read after the fact.
export const OUTCOME_TEXT: Record<ConsultationOutcome, string> = {
  SEND_TO_PHARMACY: "Sent to the pharmacy",
  CONTINUE_INVESTIGATION: "Investigation continuing",
  FINISH_NO_MEDICATION: "Finished without medication",
  REFER_OR_TRANSFER: "Referred to another facility",
};
