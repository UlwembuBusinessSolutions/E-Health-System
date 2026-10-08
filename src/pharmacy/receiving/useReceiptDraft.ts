import { useCallback, useMemo, useState } from "react";
import type { SupplierRef } from "@/pharmacy/suppliers/supplierName";
import { readStored, removeStored, writeStored } from "./localStore";
import type { ReceiptLineDraft } from "./receiptTypes";

export interface ReceiptDraft {
  supplier: SupplierRef | null;
  invoiceNumber: string;
  lines: ReceiptLineDraft[];
  savedAt: string;
}

function isReceiptDraft(value: unknown): value is ReceiptDraft {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ReceiptDraft>;
  return Array.isArray(candidate.lines) && typeof candidate.invoiceNumber === "string" && typeof candidate.savedAt === "string";
}

// One draft per facility: a pharmacist can park a half-checked delivery and
// come back, but two facilities' paperwork never mixes.
const draftKey = (facilityId: string) => `pharmacy.receiptDraft.${facilityId}`;

export function useReceiptDraft(facilityId: string) {
  // localStorage is not reactive, so a counter tells the read below to run again after save/clear.
  const [revision, setRevision] = useState(0);

  const draft = useMemo(
    () => (facilityId ? readStored(draftKey(facilityId), isReceiptDraft) : null),
    // `revision` is the intended trigger, not a value the callback reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facilityId, revision],
  );

  const saveDraft = useCallback(
    (content: Omit<ReceiptDraft, "savedAt">): boolean => {
      const stored = writeStored(draftKey(facilityId), { ...content, savedAt: new Date().toISOString() });
      setRevision((current) => current + 1);
      return stored;
    },
    [facilityId],
  );

  const clearDraft = useCallback(() => {
    removeStored(draftKey(facilityId));
    setRevision((current) => current + 1);
  }, [facilityId]);

  return { draft, saveDraft, clearDraft };
}
