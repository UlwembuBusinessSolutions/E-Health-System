import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { getRegisterPage, listScheduledProducts } from "@/shared/api/pharmacyCounts";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FacilityField } from "../components/FacilityField";
import { PrintArea } from "../components/PrintArea";
import { SkeletonRows } from "../components/SkeletonRows";
import { downloadTextFile } from "../lib/csv";
import { describeError } from "../lib/problem";
import { usePharmacyFacility } from "../lib/usePharmacyFacility";
import { DayCloseCard } from "./DayCloseCard";
import { RecordRemovalDialog } from "./RecordRemovalDialog";
import { RegisterBook } from "./RegisterBook";
import { registerFilename, registerToCsv } from "./registerCsv";
import { registerKeys } from "./registerKeys";
import { businessDateOf } from "./registerMath";
import { ScheduledProductPicker } from "./ScheduledProductPicker";

const PAGE_SIZE = 50;
// An inspector wants the whole book, not one screen of it.
const EXPORT_SIZE = 1000;

// `/app/pharmacy/register`
export function ScheduleRegisterPage() {
  const { showToast } = useToast();
  const { facilityId, facilities, setFacilityId } = usePharmacyFacility();
  const [productId, setProductId] = useState("");
  const [page, setPage] = useState(0);
  const [removing, setRemoving] = useState(false);

  const products = useQuery({
    queryKey: registerKeys.products(facilityId),
    queryFn: () => listScheduledProducts(facilityId),
    enabled: facilityId !== "",
    staleTime: 30_000,
  });
  // Until something is picked, the first scheduled medicine is shown.
  const product = products.data?.find((candidate) => candidate.productId === productId) ?? products.data?.[0];

  const book = useQuery({
    queryKey: [...registerKeys.book(facilityId, product?.productId ?? ""), page],
    queryFn: () => getRegisterPage(facilityId, product?.productId ?? "", page, PAGE_SIZE),
    enabled: facilityId !== "" && product !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const exportBook = useMutation({
    mutationFn: async () => {
      if (!product) return;
      const everything = await getRegisterPage(facilityId, product.productId, 0, EXPORT_SIZE);
      downloadTextFile(registerFilename(product), registerToCsv(everything.items));
    },
    onError: (error) => showToast(describeError(error), "error"),
  });

  function choose(id: string) {
    setProductId(id);
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Scheduled medicines register"
        description="One running book per Schedule 5 and 6 medicine. Entries are added, never edited."
        action={
          <Button disabled={!product} onClick={() => setRemoving(true)}>
            Record removal
          </Button>
        }
      />
      <FacilityField facilities={facilities} value={facilityId} onChange={(id) => { setFacilityId(id); setProductId(""); setPage(0); }} />

      {products.isLoading && <SkeletonRows rows={3} />}
      {products.error && <ErrorState message={describeError(products.error)} onRetry={() => void products.refetch()} />}
      {products.data?.length === 0 && (
        <EmptyState title="No scheduled medicines yet" description="Mark a product as Schedule 5 or 6 and it appears here." />
      )}

      {products.data && product && (
        <>
          <ScheduledProductPicker products={products.data} selectedId={product.productId} onSelect={choose} />

          <section aria-labelledby="book-heading" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="book-heading" className="text-[17px] font-semibold text-text-primary">
                  {product.name} {product.sub}
                </h2>
                <p className="text-[13px] text-text-secondary">
                  Schedule {product.schedule === "S6" ? "6" : "5"} &middot; {book.data?.totalItems ?? 0} entries &middot; current balance{" "}
                  {book.data?.currentBalance ?? product.onHand}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" icon={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
                  Print register page
                </Button>
                <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} loading={exportBook.isPending} onClick={() => exportBook.mutate()}>
                  Export for inspector
                </Button>
              </div>
            </div>
            <PrintArea visibleOnScreen>
              <RegisterBook
                entries={book.data?.items ?? []}
                loading={book.isLoading}
                errorMessage={book.error ? describeError(book.error) : null}
                onRetry={() => void book.refetch()}
                pagination={{
                  page,
                  size: PAGE_SIZE,
                  totalItems: book.data?.totalItems ?? 0,
                  hasMore: book.data?.hasMore ?? false,
                  onPageChange: setPage,
                }}
              />
            </PrintArea>
          </section>

          <DayCloseCard facilityId={facilityId} product={product} date={businessDateOf()} />
          <RecordRemovalDialog facilityId={facilityId} product={product} open={removing} onClose={() => setRemoving(false)} />
        </>
      )}
    </div>
  );
}
