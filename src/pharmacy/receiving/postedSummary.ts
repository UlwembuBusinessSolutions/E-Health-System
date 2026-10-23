import { formatDate } from "@/pharmacy/lib/format";
import { formatQuantity } from "@/pharmacy/lib/units";
import { FLAG_REASON_LABELS, type ReceiptLineDraft } from "./receiptTypes";
import { acceptedQuantity, coldChainProblem, receivedQuantity } from "./receiptValidation";

export interface FlaggedItem {
  name: string;
  reason: string;
  detail: string;
}

/** Everything the success screen shows, captured at the moment of posting. */
export interface PostedSummary {
  receiptNumber: string;
  facilityId: string;
  supplierName: string;
  invoiceNumber: string;
  lineCount: number;
  acceptedUnits: number;
  flagged: FlaggedItem[];
}

function describeFlag(line: ReceiptLineDraft): FlaggedItem | null {
  const { flag, product } = line;
  if (!flag?.reason) return null;

  const received = receivedQuantity(line);
  const rejected = received - acceptedQuantity(line);
  const parts: string[] = [];
  if (rejected > 0) parts.push(`${formatQuantity(rejected, product.baseUnit)} of ${received} rejected`);
  const cold = coldChainProblem(line);
  if (cold) parts.push(cold);
  if (flag.note.trim()) parts.push(flag.note.trim());

  return { name: product.displayName, reason: FLAG_REASON_LABELS[flag.reason], detail: parts.join(". ") };
}

export function summarisePostedReceipt(
  receiptNumber: string,
  context: { facilityId: string; supplierName: string; invoiceNumber: string },
  lines: ReceiptLineDraft[],
): PostedSummary {
  return {
    receiptNumber,
    ...context,
    lineCount: lines.length,
    acceptedUnits: lines.reduce((sum, line) => sum + acceptedQuantity(line), 0),
    flagged: lines.flatMap((line) => describeFlag(line) ?? []),
  };
}

/** Plain-text note a pharmacist can paste into an email or WhatsApp to the supplier. */
export function buildSupplierMessage(summary: PostedSummary, today: Date = new Date()): string {
  const reference = summary.invoiceNumber ? ` (invoice ${summary.invoiceNumber})` : "";
  const header = `Hello ${summary.supplierName}, we received your delivery${reference} on ${formatDate(today.toISOString())} and found these problems:`;
  const items = summary.flagged.map((item) => `- ${item.name}: ${item.reason}${item.detail ? `. ${item.detail}` : ""}`);
  return [header, ...items, "Please advise how you would like to resolve this."].join("\n");
}
