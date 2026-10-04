import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import type { PharmacyProduct } from "@/shared/api/pharmacyStock";
import { postReceipt, type PostReceiptPayload } from "@/shared/api/pharmacyReceiving";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { Select } from "@/shared/components/Select";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { EmptyState } from "@/pharmacy/components/EmptyState";
import { ErrorState } from "@/pharmacy/components/ErrorState";
import { formatDate, formatDateTime } from "@/pharmacy/lib/format";
import { describeError } from "@/pharmacy/lib/problem";
import { invalidateAfterStockMovement, pharmacyKeys } from "@/pharmacy/lib/queryKeys";
import { useAttemptKey } from "@/pharmacy/lib/useAttemptKey";
import { useFacilitySelection } from "@/pharmacy/lib/useFacilitySelection";
import type { SupplierRef } from "@/pharmacy/suppliers/supplierName";
import { AddProductPanel } from "./AddProductPanel";
import { ProductFinder } from "./ProductFinder";
import { ReceiptLineCard } from "./ReceiptLineCard";
import { buildReceiptPayload } from "./receiptPayload";
import { ReceiptPostedView } from "./ReceiptPostedView";
import { ReceiptSummary } from "./ReceiptSummary";
import { summarisePostedReceipt, type PostedSummary } from "./postedSummary";
import { toReceivableProduct, type ReceiptLineDraft } from "./receiptTypes";
import { acceptedQuantity, isoToday, validateReceipt } from "./receiptValidation";
import { SupplierPicker } from "./SupplierPicker";
import { useReceiptDraft } from "./useReceiptDraft";
import { useReceiptLines } from "./useReceiptLines";
import { useRecentProducts } from "./useRecentProducts";

// What the success screen needs, captured when posting starts: the form may
// change while the request is in flight, and the summary must describe what was sent.
interface PostAttempt {
  payload: PostReceiptPayload;
  lines: ReceiptLineDraft[];
  supplierName: string;
  invoiceNumber: string;
}

export function ReceiveStockPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { keyFor, settle } = useAttemptKey();
  const {
    facilities,
    facilityId,
    selectFacility,
    error: facilitiesError,
    refetch: refetchFacilities,
    isFetching: facilitiesFetching,
  } = useFacilitySelection();

  const [supplier, setSupplier] = useState<SupplierRef | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const { lines, addProduct, updateLine, removeLine, replaceLines } = useReceiptLines();
  const [newProductName, setNewProductName] = useState<string | null>(null);
  const [posted, setPosted] = useState<PostedSummary | null>(null);

  const { draft, saveDraft, clearDraft } = useReceiptDraft(facilityId);
  const { recent, remember } = useRecentProducts(facilityId);

  const today = isoToday();
  const validation = useMemo(
    () => validateReceipt({ facilityId, supplierId: supplier?.id ?? null, lines }, today),
    [facilityId, supplier, lines, today],
  );
  const acceptedUnits = lines.reduce((sum, line) => sum + acceptedQuantity(line), 0);
  const flaggedCount = lines.filter((line) => line.flag !== null).length;

  const post = useMutation({
    mutationFn: (attempt: PostAttempt) => postReceipt(attempt.payload, keyFor(attempt.payload)),
    onError: settle,
    onSuccess: (receipt, attempt) => {
      settle();
      setPosted(
        summarisePostedReceipt(
          receipt.receiptNumber,
          { facilityId, supplierName: attempt.supplierName, invoiceNumber: attempt.invoiceNumber },
          attempt.lines,
        ),
      );
      remember(attempt.lines.map((line) => line.product));
      clearDraft();
      void invalidateAfterStockMovement(queryClient);
    },
  });

  function handlePost() {
    if (validation.hint !== null || !supplier || post.isPending) return;
    const payload = buildReceiptPayload({ facilityId, supplierId: supplier.id, invoiceNumber, lines });
    post.mutate({ payload, lines, supplierName: supplier.name, invoiceNumber: invoiceNumber.trim() });
  }

  function handleSaveDraft() {
    const stored = saveDraft({ supplier, invoiceNumber, lines });
    showToast(
      stored ? "Draft saved on this device." : "Couldn't save the draft: this browser blocked local storage.",
      stored ? "success" : "error",
    );
  }

  function handleResumeDraft() {
    if (!draft) return;
    setSupplier(draft.supplier);
    setInvoiceNumber(draft.invoiceNumber);
    replaceLines(draft.lines);
    post.reset();
  }

  function handleProductCreated(product: PharmacyProduct) {
    addProduct(toReceivableProduct(product));
    setNewProductName(null);
    void queryClient.invalidateQueries({ queryKey: pharmacyKeys.products.all });
    showToast(`${product.displayName} added to the catalog and to this receipt.`, "success");
  }

  function handleReceiveAnother() {
    setPosted(null);
    setSupplier(null);
    setInvoiceNumber("");
    replaceLines([]);
    post.reset();
  }

  if (posted) return <ReceiptPostedView summary={posted} onReceiveAnother={handleReceiveAnother} />;

  return (
    <div className="pb-40 lg:pb-0">
      <PageHeader
        title="Receive stock"
        description="Scan or search each product, enter what arrived, post once."
        action={
          draft && (
            <Button variant="secondary" icon={<History className="size-4" aria-hidden />} onClick={handleResumeDraft}>
              Resume draft ({formatDateTime(draft.savedAt)})
            </Button>
          )
        }
      />

      {facilitiesError ? (
        <Card>
          <ErrorState
            message={describeError(facilitiesError)}
            retrying={facilitiesFetching}
            onRetry={() => void refetchFacilities()}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card className="p-4 sm:p-5">
              <h2 className="mb-4 text-[15px] font-semibold text-text-primary">1. Delivery details</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label="Into facility"
                  required
                  options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
                  value={facilityId}
                  onChange={(event) => selectFacility(event.target.value)}
                />
                <Input label="Received on" readOnly value={formatDate(today)} />
                <SupplierPicker value={supplier} onChange={setSupplier} />
                <Input
                  label="Invoice or delivery note no."
                  autoComplete="off"
                  maxLength={100}
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                />
              </div>
            </Card>

            <section aria-labelledby="receive-products-heading" className="flex flex-col gap-4">
              <h2 id="receive-products-heading" className="text-[15px] font-semibold text-text-primary">
                2. Products received
              </h2>
              <ProductFinder recent={recent} onSelect={addProduct} onAddNew={setNewProductName} />

              {lines.length === 0 ? (
                <Card>
                  <EmptyState title="No lines yet" description="Search or scan a product above to add it to this receipt." />
                </Card>
              ) : (
                <ul className="flex flex-col gap-4">
                  {lines.map((line) => (
                    <li key={line.key}>
                      <ReceiptLineCard
                        line={line}
                        issues={validation.lineIssues.get(line.key) ?? {}}
                        onChange={(patch) => updateLine(line.key, patch)}
                        onRemove={() => removeLine(line.key)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <ReceiptSummary
            lineCount={lines.length}
            acceptedUnits={acceptedUnits}
            supplierName={supplier?.name ?? null}
            flaggedCount={flaggedCount}
            hint={validation.hint}
            errorMessage={post.isError ? describeError(post.error, "Couldn't post this receipt. Please try again.") : null}
            posting={post.isPending}
            canSaveDraft={lines.length > 0 || supplier !== null || invoiceNumber.trim() !== ""}
            draftSavedAt={draft?.savedAt ?? null}
            onPost={handlePost}
            onSaveDraft={handleSaveDraft}
          />
        </div>
      )}

      {newProductName !== null && facilityId && (
        <AddProductPanel
          facilityId={facilityId}
          initialName={newProductName}
          onCreated={handleProductCreated}
          onClose={() => setNewProductName(null)}
        />
      )}
    </div>
  );
}
