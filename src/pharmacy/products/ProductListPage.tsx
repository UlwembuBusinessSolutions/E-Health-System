import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Archive, ArchiveRestore, ChevronLeft, ChevronRight, Package, Plus, Search } from "lucide-react";
import { archiveProduct, listProducts, reactivateProduct, type PharmacyProduct } from "@/shared/api/pharmacyStock";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";
import { useToast } from "@/shared/components/toast/ToastProvider";

const PAGE_SIZE = 50;

function formatUnit(unit: string): string {
  return unit.charAt(0) + unit.slice(1).toLowerCase().replace(/_/g, " ");
}

// The organization catalog — plan section 11: `/app/pharmacy/products`.
// Archive/reactivate call the same endpoint every other lifecycle toggle
// in this app uses (StaffListPage's own enable/disable, OrganizationDetailPage's
// suspend/reactivate) — a POST action, not a DELETE, since archiving never
// removes history (plan rule 3).
export function ProductListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(0);

  const productsQuery = useQuery({
    queryKey: ["pharmacy", "products", { search, activeOnly, page }],
    queryFn: () => listProducts({ q: search || undefined, activeOnly, page, size: PAGE_SIZE }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => archiveProduct(id),
    onSuccess: () => {
      showToast("Product archived.", "success");
      queryClient.invalidateQueries({ queryKey: ["pharmacy", "products"] });
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't archive that product. Try again.", "error");
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => reactivateProduct(id),
    onSuccess: () => {
      showToast("Product reactivated.", "success");
      queryClient.invalidateQueries({ queryKey: ["pharmacy", "products"] });
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't reactivate that product. Try again.", "error");
    },
  });

  function updateSearch(value: string) {
    setSearch(value);
    setPage(0);
  }

  const products = productsQuery.data?.items ?? [];
  const totalItems = productsQuery.data?.totalItems ?? 0;
  const hasMore = productsQuery.data?.hasMore ?? false;

  return (
    <div>
      <PageHeader
        title="Products"
        description="Your organization's medicine and supply catalog."
        action={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => navigate("/app/pharmacy/products/new")}>
            Add product
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Input
          label="Search"
          icon={<Search className="size-4" aria-hidden />}
          placeholder="Name, code, generic name or barcode"
          value={search}
          onChange={(e) => updateSearch(e.target.value)}
          className="sm:w-80"
        />
        <button
          type="button"
          onClick={() => {
            setActiveOnly((v) => !v);
            setPage(0);
          }}
          className="h-11 shrink-0 rounded-lg px-3 text-[13.5px] font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-50"
        >
          {activeOnly ? "Show archived too" : "Show active only"}
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        {productsQuery.isLoading ? (
          <p className="px-5 py-8 text-center text-[13.5px] text-text-secondary">Loading products…</p>
        ) : productsQuery.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <p className="text-[13.5px] text-text-secondary">Products couldn't be loaded. Please try again.</p>
            <Button variant="secondary" loading={productsQuery.isFetching} onClick={() => void productsQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <Package className="size-5 text-text-secondary" aria-hidden />
            <p className="text-[13.5px] text-text-secondary">
              {search ? "No products match your search." : "No products yet."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {products.map((product: PharmacyProduct) => (
              <div key={product.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <Link to={`/app/pharmacy/products/${product.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-medium text-text-primary">{product.displayName}</p>
                    <StatusPill tone={product.active ? "success" : "neutral"}>
                      {product.active ? "Active" : "Archived"}
                    </StatusPill>
                  </div>
                  <p className="truncate text-[12.5px] text-text-secondary">
                    {product.code}
                    {product.strength ? ` · ${product.strength}` : ""}
                    {product.dosageForm ? ` · ${product.dosageForm}` : ""} · {formatUnit(product.baseUnit)}
                  </p>
                </Link>
                <div className="shrink-0">
                  {product.active ? (
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<Archive className="size-3.5" aria-hidden />}
                      loading={archiveMutation.isPending && archiveMutation.variables === product.id}
                      onClick={() => archiveMutation.mutate(product.id)}
                    >
                      Archive
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<ArchiveRestore className="size-3.5" aria-hidden />}
                      loading={reactivateMutation.isPending && reactivateMutation.variables === product.id}
                      onClick={() => reactivateMutation.mutate(product.id)}
                    >
                      Reactivate
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!productsQuery.isLoading && !productsQuery.isError && products.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-5 py-3">
            <p className="text-[12px] text-text-secondary">
              Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + products.length} of {totalItems}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={<ChevronLeft className="size-3.5" aria-hidden />}
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<ChevronRight className="size-3.5" aria-hidden />}
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
