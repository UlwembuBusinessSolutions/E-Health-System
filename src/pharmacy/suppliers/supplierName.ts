// Mirrors the backend's `name_key` rule (lower-case, drop company suffixes and
// punctuation) so the dialog can warn about duplicates while the user types.
// The server stays the authority: it re-checks on save and answers 409.
const COMPANY_WORDS = /\b(pty|ltd|limited|the|and|co|cc)\b/g;

// Short keys ("abc") would match half the list as "similar", so near-matches
// only count once both names are a few characters long.
const MIN_SIMILAR_KEY_LENGTH = 5;

export function supplierNameKey(name: string): string {
  return name.toLowerCase().replace(COMPANY_WORDS, "").replace(/[^a-z0-9]/g, "");
}

export interface SupplierRef {
  id: string;
  name: string;
}

export interface DuplicateMatch {
  existing: SupplierRef;
  /** Exact = same name key (blocked). Otherwise one name contains the other (warning). */
  exact: boolean;
}

/** First supplier whose name collides with `name`; `ignoreId` excludes the supplier being edited. */
export function findDuplicateSupplier(
  name: string,
  suppliers: SupplierRef[],
  ignoreId?: string,
): DuplicateMatch | null {
  const key = supplierNameKey(name);
  if (!key) return null;

  let similar: DuplicateMatch | null = null;
  for (const candidate of suppliers) {
    if (candidate.id === ignoreId) continue;
    const candidateKey = supplierNameKey(candidate.name);
    if (candidateKey === key) return { existing: candidate, exact: true };
    const bothLongEnough = key.length >= MIN_SIMILAR_KEY_LENGTH && candidateKey.length >= MIN_SIMILAR_KEY_LENGTH;
    const overlaps = candidateKey.includes(key) || key.includes(candidateKey);
    if (!similar && bothLongEnough && overlaps) similar = { existing: candidate, exact: false };
  }
  return similar;
}
