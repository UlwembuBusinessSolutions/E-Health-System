import { ApiError } from "@/shared/api/client";
import { DUPLICATE_SUPPLIER_CODE } from "@/shared/api/pharmacyReceiving";
import { WITNESS_REQUIRED_MESSAGE } from "@/shared/api/pharmacy";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** The machine-readable `code` of a problem response, e.g. `DUPLICATE_SUPPLIER`. */
export function problemCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/** True when the server refused a Schedule 6 dispense or hand-over for lack of a witness. */
export function isWitnessRequired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422 && error.message === WITNESS_REQUIRED_MESSAGE;
}

function describeDuplicateSupplier(error: ApiError): string {
  return error.existing
    ? `A supplier called "${error.existing.name}" already exists. Use it, or choose a different name.`
    : "A supplier with this name already exists.";
}

/** Turns any thrown value into a sentence a pharmacist can act on. */
export function describeError(error: unknown, fallback = FALLBACK_MESSAGE): string {
  if (error instanceof ApiError) {
    if (error.code === DUPLICATE_SUPPLIER_CODE) return describeDuplicateSupplier(error);
    if (error.status === 403) return "You don't have permission to do that.";
    if (error.status >= 500) return fallback;
    return error.message || fallback;
  }
  // fetch() rejects with a TypeError when the server can't be reached at all.
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return fallback;
}
