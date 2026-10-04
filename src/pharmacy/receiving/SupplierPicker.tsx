import { useId, useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";
import type { Supplier } from "@/shared/api/pharmacyReceiving";
import { Button } from "@/shared/components/Button";
import { ErrorState } from "@/pharmacy/components/ErrorState";
import { SkeletonRows } from "@/pharmacy/components/SkeletonRows";
import { formatDate } from "@/pharmacy/lib/format";
import { describeError } from "@/pharmacy/lib/problem";
import { SupplierDialog } from "@/pharmacy/suppliers/SupplierDialog";
import type { SupplierRef } from "@/pharmacy/suppliers/supplierName";
import { useSuppliers } from "@/pharmacy/suppliers/useSuppliers";

const MAX_SUGGESTIONS = 6;

interface SupplierPickerProps {
  value: SupplierRef | null;
  onChange: (supplier: SupplierRef | null) => void;
}

function matches(supplier: Supplier, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || supplier.name.toLowerCase().includes(needle);
}

function describeSupplier(supplier: Supplier): string {
  const parts = [
    supplier.lastReceivedAt ? `Last used ${formatDate(supplier.lastReceivedAt)}` : null,
    supplier.phone,
  ].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

export function SupplierPicker({ value, onChange }: SupplierPickerProps) {
  const inputId = useId();
  const suppliers = useSuppliers("ACTIVE");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const suggestions = useMemo(
    () => (suppliers.data ?? []).filter((supplier) => matches(supplier, query)).slice(0, MAX_SUGGESTIONS),
    [suppliers.data, query],
  );

  function choose(supplier: SupplierRef) {
    onChange({ id: supplier.id, name: supplier.name });
    setQuery("");
    setDialogOpen(false);
  }

  if (value) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-text-primary">Supplier</span>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border-strong bg-surface-raised py-1 pl-3.5 pr-1">
          <span className="min-w-0 truncate text-[15px] font-medium text-text-primary">{value.name}</span>
          <Button variant="ghost" onClick={() => onChange(null)} aria-label={`Change supplier, currently ${value.name}`}>
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-text-primary">
        Supplier <span className="text-danger-500">*</span>
      </label>
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        placeholder="Search suppliers"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-11 w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[15px] text-text-primary outline-none placeholder:text-text-secondary/70 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
      />

      {suppliers.isLoading && <SkeletonRows rows={2} />}
      {suppliers.isError && (
        <ErrorState
          message={describeError(suppliers.error)}
          retrying={suppliers.isFetching}
          onRetry={() => void suppliers.refetch()}
        />
      )}

      {suppliers.data && (
        <ul className="overflow-hidden rounded-lg border border-border-subtle bg-surface-raised">
          {suggestions.map((supplier) => (
            <li key={supplier.id} className="border-b border-border-subtle last:border-b-0">
              <button
                type="button"
                onClick={() => choose(supplier)}
                className="flex min-h-11 w-full flex-col justify-center px-3.5 py-2 text-left hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
              >
                <span className="text-[14px] font-medium text-text-primary">{supplier.name}</span>
                {describeSupplier(supplier) && (
                  <span className="text-[12.5px] text-text-secondary">{describeSupplier(supplier)}</span>
                )}
              </button>
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="flex items-center gap-2 px-3.5 py-3 text-[13.5px] text-text-secondary">
              <Truck className="size-4 shrink-0" aria-hidden />
              {query.trim() ? `No supplier matches "${query.trim()}".` : "No active suppliers yet."}
            </li>
          )}
          <li>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="flex min-h-11 w-full items-center gap-2 px-3.5 py-2 text-left text-[14px] font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              {query.trim() ? `Add "${query.trim()}" as a new supplier` : "Add a new supplier"}
            </button>
          </li>
        </ul>
      )}

      {dialogOpen && (
        <SupplierDialog
          initialName={query.trim()}
          onClose={() => setDialogOpen(false)}
          onSaved={choose}
          onUseExisting={choose}
        />
      )}
    </div>
  );
}
