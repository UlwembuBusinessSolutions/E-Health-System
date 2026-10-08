import { lazy, Suspense, type ComponentType, type ReactNode } from "react";

// The pharmacy module is large and only some staff ever open it, so each of
// its pages is its own chunk, fetched the first time its route is visited.
// The pages are named exports, hence the small adapter to React.lazy's
// default-export shape.
function lazyPage<Name extends string>(load: () => Promise<Record<Name, ComponentType>>, name: Name) {
  return lazy(async () => ({ default: (await load())[name] }));
}

export const PharmacyLayout = lazyPage(() => import("@/pharmacy/PharmacyLayout"), "PharmacyLayout");
export const DispensingQueuePage = lazyPage(() => import("@/pharmacy/dispensing/DispensingQueuePage"), "DispensingQueuePage");
export const PrescriptionPrintPage = lazyPage(() => import("@/pharmacy/PrescriptionPrintPage"), "PrescriptionPrintPage");
export const StockPage = lazyPage(() => import("@/pharmacy/stock/StockPage"), "StockPage");
export const AddProductPage = lazyPage(() => import("@/pharmacy/products/AddProductPage"), "AddProductPage");
export const ReceiveStockPage = lazyPage(() => import("@/pharmacy/receiving/ReceiveStockPage"), "ReceiveStockPage");
export const SuppliersPage = lazyPage(() => import("@/pharmacy/suppliers/SuppliersPage"), "SuppliersPage");
export const ReorderPage = lazyPage(() => import("@/pharmacy/reorder/ReorderPage"), "ReorderPage");
export const LedgerPage = lazyPage(() => import("@/pharmacy/ledger/LedgerPage"), "LedgerPage");
export const StockCountPage = lazyPage(() => import("@/pharmacy/counts/StockCountPage"), "StockCountPage");
export const ScheduleRegisterPage = lazyPage(() => import("@/pharmacy/register/ScheduleRegisterPage"), "ScheduleRegisterPage");
export const ImportPage = lazyPage(() => import("@/pharmacy/import/ImportPage"), "ImportPage");
export const OpeningStockPage = lazyPage(() => import("@/pharmacy/opening-stock/OpeningStockPage"), "OpeningStockPage");

/** Shown while a page's chunk loads; announced to screen readers, and quiet for people who avoid motion. */
export function PageLoading() {
  return (
    <div role="status" className="flex min-h-40 items-center justify-center gap-3 text-[14px] text-text-secondary">
      <span
        aria-hidden
        className="size-5 animate-spin rounded-full border-2 border-border-strong border-t-brand-500 motion-reduce:animate-none"
      />
      Loading…
    </div>
  );
}

export function WithPageLoading({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoading />}>{children}</Suspense>;
}
