import { useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import type { ReorderSupplier } from "@/shared/api/pharmacyPlanning";
import { Card } from "@/shared/components/Card";
import { Select } from "@/shared/components/Select";
import { SearchInput } from "../components/SearchInput";

interface SupplierSidebarProps {
  suppliers: ReorderSupplier[];
  selectedId: string;
  onSelect: (supplierId: string) => void;
}

function toOrderLabel(supplier: ReorderSupplier): string {
  return supplier.toOrderCount > 0 ? `${supplier.toOrderCount} to order` : "Nothing to order";
}

const ADD_SUPPLIER_LINK =
  "inline-flex min-h-11 items-center text-[13.5px] font-medium text-brand-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

// Below `lg` the list becomes a dropdown: a tall list would push the order
// itself off a phone screen.
export function SupplierSidebar({ suppliers, selectedId, onSelect }: SupplierSidebarProps) {
  const [query, setQuery] = useState("");
  const visible = suppliers.filter((supplier) => supplier.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <aside aria-label="Suppliers" className="flex flex-col gap-3">
      <div className="lg:hidden">
        <Select
          label="Order from"
          value={selectedId}
          options={suppliers.map((supplier) => ({ value: supplier.id, label: `${supplier.name} (${toOrderLabel(supplier)})` }))}
          onChange={(event) => onSelect(event.target.value)}
        />
      </div>

      <Card className="hidden flex-col gap-3 p-3 lg:flex">
        <SearchInput label="Search suppliers" onSearch={setQuery} />
        <ul className="flex flex-col gap-1">
          {visible.map((supplier) => (
            <li key={supplier.id}>
              <button
                type="button"
                aria-current={supplier.id === selectedId}
                onClick={() => onSelect(supplier.id)}
                className={clsx(
                  "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[14px] font-medium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  supplier.id === selectedId ? "bg-brand-50 text-brand-700" : "text-text-primary hover:bg-surface-sunken",
                )}
              >
                <span className="truncate">{supplier.name}</span>
                {supplier.toOrderCount > 0 && (
                  <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-600">
                    {toOrderLabel(supplier)}
                  </span>
                )}
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="px-3 py-2 text-[13.5px] text-text-secondary">No supplier matches.</li>}
        </ul>
      </Card>

      <Link to="/app/pharmacy/suppliers" className={ADD_SUPPLIER_LINK}>
        + Add a supplier
      </Link>
    </aside>
  );
}
