import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Layers } from "lucide-react";
import { getProduct, listBatches } from "@/shared/api/pharmacyStock";
import { Card } from "@/shared/components/Card";
import { StatusPill } from "@/shared/components/StatusPill";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

// Plan section 11: `/app/pharmacy/products/:productId` — "Details,
// batches, ledger and audit." Phase 1 shows details + batches; the
// product's own ledger slice is one click away via the Ledger tab's
// product filter rather than duplicated inline here.
export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();

  const productQuery = useQuery({
    queryKey: ["pharmacy", "products", productId],
    queryFn: () => getProduct(productId ?? ""),
    enabled: !!productId,
  });
  const batchesQuery = useQuery({
    queryKey: ["pharmacy", "products", productId, "batches"],
    queryFn: () => listBatches(productId ?? ""),
    enabled: !!productId,
  });

  const product = productQuery.data;
  const totalStock = (batchesQuery.data ?? []).reduce((sum, b) => sum + b.quantity, 0);

  return (
    <div>
      <Link
        to="/app/pharmacy/products"
        className="mb-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to products
      </Link>

      {productQuery.isLoading ? (
        <p className="text-[14px] text-text-secondary">Loading…</p>
      ) : !product ? (
        <p className="text-[14px] text-text-secondary">This product couldn't be found.</p>
      ) : (
        <>
          <Card className="mb-6 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[19px] font-semibold text-text-primary">{product.displayName}</h1>
                  <StatusPill tone={product.active ? "success" : "neutral"}>
                    {product.active ? "Active" : "Archived"}
                  </StatusPill>
                </div>
                <p className="mt-1 font-mono text-[13px] text-text-secondary">{product.code}</p>
              </div>
              <div className="text-right">
                <p className="text-[22px] font-semibold text-text-primary">{totalStock}</p>
                <p className="text-[12px] text-text-secondary">on hand, {product.baseUnit.toLowerCase()}s</p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-4">
              <div>
                <dt className="text-text-secondary">Generic name</dt>
                <dd className="text-text-primary">{product.genericName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Strength / form</dt>
                <dd className="text-text-primary">
                  {[product.strength, product.dosageForm].filter(Boolean).join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-text-secondary">Category</dt>
                <dd className="text-text-primary">{product.category}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Pack size</dt>
                <dd className="text-text-primary">{product.packSize ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Batch tracked</dt>
                <dd className="text-text-primary">{product.batchTracked ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Expiry tracked</dt>
                <dd className="text-text-primary">{product.expiryTracked ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-text-secondary">Added by</dt>
                <dd className="text-text-primary">
                  {product.createdByName} · {formatDate(product.createdAt)}
                </dd>
              </div>
              {product.updatedByName && (
                <div>
                  <dt className="text-text-secondary">Last changed by</dt>
                  <dd className="text-text-primary">
                    {product.updatedByName} · {formatDate(product.updatedAt)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[14.5px] font-semibold text-text-primary">Batches</h2>
              <p className="text-[12.5px] text-text-secondary">Ordered by earliest expiry first (FEFO).</p>
            </div>
            {batchesQuery.isLoading ? (
              <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading batches…</p>
            ) : (batchesQuery.data ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                <Layers className="size-5 text-text-secondary" aria-hidden />
                <p className="text-[13.5px] text-text-secondary">No stock received for this product yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {(batchesQuery.data ?? []).map((batch) => (
                  <div key={batch.batchId} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-text-primary">
                        Lot {batch.lotNumber}
                        {batch.manufacturer ? ` · ${batch.manufacturer}` : ""}
                      </p>
                      <p className="text-[12.5px] text-text-secondary">
                        {batch.expiryDate ? `Expires ${formatDate(batch.expiryDate)}` : "No expiry tracked"}
                      </p>
                    </div>
                    <p className="shrink-0 text-[14px] font-semibold text-text-primary">{batch.quantity}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
