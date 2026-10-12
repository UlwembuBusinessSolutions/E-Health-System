import type { QueryClient } from "@tanstack/react-query";
import type { CountStatus } from "@/shared/api/pharmacyCounts";

// Every pharmacy cache key lives here, under one `["pharmacy", <area>, ...]`
// shape. Keeping the prefixes in one file is what makes invalidation
// trustworthy: a stock movement can name whole areas stale without a screen
// having to remember which keys it happens to use.
const ROOT = "pharmacy" as const;

export const pharmacyKeys = {
  stock: {
    all: [ROOT, "stock"] as const,
    list: (facilityId: string) => [ROOT, "stock", "list", facilityId] as const,
    dashboard: (facilityId: string) => [ROOT, "stock", "dashboard", facilityId] as const,
    lots: (productId: string) => [ROOT, "stock", "lots", productId] as const,
    history: (productId: string, facilityId: string) => [ROOT, "stock", "history", productId, facilityId] as const,
  },
  products: {
    all: [ROOT, "products"] as const,
    detail: (productId: string) => [ROOT, "products", "detail", productId] as const,
    search: (scope: string, text: string) => [ROOT, "products", "search", scope, text] as const,
  },
  ledger: {
    all: [ROOT, "ledger"] as const,
    list: (filters: unknown, paging: { page: number; size: number }) => [ROOT, "ledger", "list", filters, paging] as const,
    balance: (facilityId: string, productId: string) => [ROOT, "ledger", "balance", facilityId, productId] as const,
  },
  receipts: {
    all: [ROOT, "receipts"] as const,
    list: (filters: unknown) => [ROOT, "receipts", "list", filters] as const,
    detail: (receiptId: string) => [ROOT, "receipts", "detail", receiptId] as const,
  },
  suppliers: {
    all: [ROOT, "suppliers"] as const,
    list: (status: string) => [ROOT, "suppliers", "list", status] as const,
    options: [ROOT, "suppliers", "options"] as const,
    receipts: (supplierId: string) => [ROOT, "suppliers", "receipts", supplierId] as const,
  },
  reorder: {
    all: [ROOT, "reorder"] as const,
    suppliers: (facilityId: string) => [ROOT, "reorder", "suppliers", facilityId] as const,
    sheet: (facilityId: string, supplierId: string) => [ROOT, "reorder", "sheet", facilityId, supplierId] as const,
  },
  counts: {
    all: [ROOT, "counts"] as const,
    setup: (facilityId: string) => [ROOT, "counts", "setup", facilityId] as const,
    list: (facilityId: string, status: CountStatus) => [ROOT, "counts", "list", facilityId, status] as const,
    detail: (countId: string, revealSystem: boolean) => [ROOT, "counts", "detail", countId, revealSystem] as const,
    detailOf: (countId: string) => [ROOT, "counts", "detail", countId] as const,
  },
  register: {
    all: [ROOT, "register"] as const,
    products: (facilityId: string) => [ROOT, "register", "products", facilityId] as const,
    book: (facilityId: string, productId: string) => [ROOT, "register", "book", facilityId, productId] as const,
    dayClose: (facilityId: string, productId: string, date: string) =>
      [ROOT, "register", "day-close", facilityId, productId, date] as const,
    witnesses: (facilityId: string) => [ROOT, "register", "witnesses", facilityId] as const,
  },
  dispensing: {
    all: [ROOT, "dispensing"] as const,
    queue: (facilityId: string) => [ROOT, "dispensing", "queue", facilityId] as const,
    prescription: (prescriptionId: string) => [ROOT, "dispensing", "prescription", prescriptionId] as const,
    search: (facilityId: string, query: string) => [ROOT, "dispensing", "search", facilityId, query] as const,
    arrivals: (facilityId: string) => [ROOT, "dispensing", "arrivals", facilityId] as const,
    collection: (prescriptionId: string) => [ROOT, "dispensing", "collection", prescriptionId] as const,
  },
  imports: {
    all: [ROOT, "imports"] as const,
    recent: (facilityId: string) => [ROOT, "imports", "recent", facilityId] as const,
    check: (supplierId: string | null, invoiceNumber: string, rows: unknown) =>
      [ROOT, "imports", "check", supplierId, invoiceNumber, rows] as const,
  },
  opening: {
    validate: (facilityId: string, rows: unknown) => [ROOT, "opening-stock", "validate", facilityId, rows] as const,
  },
};

// Everything a quantity change on the shelf can make stale: the stock list and
// its dashboard counts, the ledger and receipts that record it, the reorder
// suggestions and open counts computed from it, the scheduled-medicines
// register balances, and what the dispensing queue says is in stock. Receiving,
// adjusting, reversing, counting and dispensing all go through here, so none of
// them can forget one.
export function invalidateAfterStockMovement(queryClient: QueryClient): Promise<unknown> {
  return Promise.all(
    [
      pharmacyKeys.stock.all,
      pharmacyKeys.ledger.all,
      pharmacyKeys.receipts.all,
      pharmacyKeys.reorder.all,
      pharmacyKeys.counts.all,
      pharmacyKeys.register.all,
      pharmacyKeys.dispensing.all,
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
