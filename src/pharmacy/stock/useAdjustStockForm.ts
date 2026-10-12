import { useState } from "react";
import type { AdjustmentMode, AdjustmentReason, BatchRow, StockRow } from "@/shared/api/pharmacyStock";
import {
  buildAdjustmentPayload,
  describeAdjustment,
  findMissingStep,
  type AdjustFormValues,
} from "./adjustStockModel";

interface UseAdjustStockFormOptions {
  product: StockRow;
  facilityId: string;
  lots: BatchRow[];
  initialMode: AdjustmentMode;
  initialBatchId?: string;
}

// Holds the dialog's answers and derives everything else from them. Nothing is
// copied into state that can be computed (the chosen lot, the payload, the
// preview), so the form can't drift out of step with the lots it was given.
export function useAdjustStockForm({ product, facilityId, lots, initialMode, initialBatchId }: UseAdjustStockFormOptions) {
  const [mode, setModeState] = useState<AdjustmentMode>(initialMode);
  const [chosenBatchId, setChosenBatchId] = useState<string | null>(initialBatchId ?? null);
  const [quantity, setQuantity] = useState(1);
  const [serials, setSerials] = useState<string[]>([]);
  const [reason, setReason] = useState<AdjustmentReason | null>(null);
  const [note, setNote] = useState("");

  // With a single lot there is nothing to choose, so it is picked for the user.
  const batchId = chosenBatchId ?? (lots.length === 1 ? lots[0].batchId : null);
  const lot = lots.find((candidate) => candidate.batchId === batchId) ?? null;
  const serialsInStock = lots.flatMap((candidate) => candidate.serialNumbers);

  // Removing can never take more than the lot (or, for lot-less products, the product) holds.
  const maxQuantity = mode === "REMOVE" ? (lot?.quantity ?? product.available) : undefined;

  // Reasons, serials and quantity mean different things per mode, so a switch starts those afresh.
  function setMode(next: AdjustmentMode) {
    if (next === mode) return;
    setModeState(next);
    setReason(null);
    setNote("");
    setSerials([]);
    setQuantity(1);
  }

  function chooseLot(id: string) {
    setChosenBatchId(id);
    setQuantity(1);
  }

  const values: AdjustFormValues = {
    facilityId,
    productId: product.productId,
    baseUnit: product.baseUnit,
    serialTracked: product.serialTracked,
    mode,
    lot,
    lotsExist: lots.length > 0,
    quantity,
    serials,
    reason,
    note,
  };

  return {
    mode,
    lot,
    quantity,
    serials,
    reason,
    note,
    maxQuantity,
    serialsInStock,
    payload: buildAdjustmentPayload(values),
    missingStep: findMissingStep(values),
    preview: describeAdjustment(values),
    setMode,
    chooseLot,
    setQuantity,
    setSerials,
    setReason,
    setNote,
  };
}
