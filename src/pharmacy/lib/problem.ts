import { ApiError } from "@/shared/api/client";

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

interface ConflictPayload {
  code?: unknown;
  existing?: { name?: unknown };
}

// ApiError only guarantees message/status/fieldErrors. A 409's structured
// body ({code, existing, similar}) is read defensively from whatever the
// client attached, so this keeps working once the client passes it on.
function conflictPayload(error: ApiError): ConflictPayload {
  return error as ApiError & ConflictPayload;
}

/** The machine-readable `code` of a problem response, e.g. `DUPLICATE_SUPPLIER`. */
export function problemCode(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const { code } = conflictPayload(error);
  return typeof code === "string" ? code : undefined;
}

function describeDuplicateSupplier(error: ApiError): string {
  const name = conflictPayload(error).existing?.name;
  return typeof name === "string"
    ? `A supplier called "${name}" already exists. Use it, or choose a different name.`
    : "A supplier with this name already exists.";
}

/** Turns any thrown value into a sentence a pharmacist can act on. */
export function describeError(error: unknown, fallback = FALLBACK_MESSAGE): string {
  if (error instanceof ApiError) {
    if (problemCode(error) === "DUPLICATE_SUPPLIER") return describeDuplicateSupplier(error);
    if (error.status === 403) return "You don't have permission to do that.";
    if (error.status >= 500) return fallback;
    return error.message || fallback;
  }
  // fetch() rejects with a TypeError when the server can't be reached at all.
  if (error instanceof TypeError) return "Can't reach the server. Check your connection and try again.";
  return fallback;
}
