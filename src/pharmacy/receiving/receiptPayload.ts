import type { PostReceiptLine, PostReceiptPayload } from "@/shared/api/pharmacyReceiving";
import type { ReceiptLineDraft } from "./receiptTypes";
import {
  acceptedQuantity,
  parseTemperature,
  receivedQuantity,
  trackingModeOf,
  unitsPerPack,
} from "./receiptValidation";

// Only fields that apply to the product's tracking are sent: the backend
// rejects, say, a lot number on a quantity-only product.
function toPostLine(line: ReceiptLineDraft): PostReceiptLine {
  const { product } = line;
  const mode = trackingModeOf(product);
  const result: PostReceiptLine = { productId: product.id, baseQuantity: receivedQuantity(line) };

  if (unitsPerPack(product) > 1 && mode !== "SERIAL") {
    result.packs = line.packs;
    result.packSizeUsed = unitsPerPack(product);
  }
  if (mode === "LOT") {
    if (line.lotNumber.trim()) result.lotNumber = line.lotNumber.trim();
    if (product.expiryTracked) {
      result.expiryDate = line.expiryDate;
      result.expiryPrecision = "DAY";
    }
  }
  if (mode === "SERIAL") result.serialNumbers = line.serials;
  if (product.coldChain) {
    result.temperatureC = parseTemperature(line.temperature) ?? undefined;
    result.coldBoxIntact = line.coldBoxIntact ?? undefined;
  }
  if (line.flag?.reason) {
    result.flag = {
      reason: line.flag.reason,
      note: line.flag.note.trim(),
      acceptedQuantity: acceptedQuantity(line),
    };
  }
  return result;
}

export interface ReceiptFormValues {
  facilityId: string;
  supplierId: string;
  invoiceNumber: string;
  lines: ReceiptLineDraft[];
}

export function buildReceiptPayload(values: ReceiptFormValues): PostReceiptPayload {
  const invoiceNumber = values.invoiceNumber.trim();
  return {
    facilityId: values.facilityId,
    supplierId: values.supplierId,
    invoiceNumber: invoiceNumber || undefined,
    lines: values.lines.map(toPostLine),
  };
}
