import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, GitMerge, Plus, Truck } from "lucide-react";
import clsx from "clsx";
import {
  archiveSupplier,
  reactivateSupplier,
  type Supplier,
} from "@/shared/api/pharmacyReceiving";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { EmptyState } from "@/pharmacy/components/EmptyState";
import { FilterChips, type FilterChipOption } from "@/pharmacy/components/FilterChips";
import { PageToolbar } from "@/pharmacy/components/PageToolbar";
import { ResponsiveTable, type TableColumn } from "@/pharmacy/components/ResponsiveTable";
import { SearchInput } from "@/pharmacy/components/SearchInput";
import { describeError } from "@/pharmacy/lib/problem";
import { pharmacyKeys } from "@/pharmacy/lib/queryKeys";
import { MergeSuppliersDialog } from "./MergeSuppliersDialog";
import { SupplierDialog } from "./SupplierDialog";
import { SupplierReceiptsList } from "./SupplierReceiptsList";
import { useSuppliers } from "./useSuppliers";

type StatusFilter = "all" | "active" | "archived";

// What the open dialog is for. One union instead of three booleans keeps
// "two dialogs open at once" unrepresentable.
type DialogState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; supplier: Supplier }
  | { kind: "merge"; duplicate?: Supplier };

function matchesFilter(supplier: Supplier, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  return (supplier.status === "ACTIVE") === (filter === "active");
}

function matchesQuery(supplier: Supplier, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [supplier.name, supplier.phone, supplier.email].some((field) => field?.toLowerCase().includes(needle));
}

export function SuppliersPage() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const suppliers = useSuppliers();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });

  const all = useMemo(() => suppliers.data ?? [], [suppliers.data]);
  const active = useMemo(() => all.filter((supplier) => supplier.status === "ACTIVE"), [all]);
  const visible = useMemo(
    () => all.filter((supplier) => matchesFilter(supplier, filter) && matchesQuery(supplier, query)),
    [all, filter, query],
  );

  const statusChips: FilterChipOption<StatusFilter>[] = [
    { value: "all", label: "All", count: all.length },
    { value: "active", label: "Active", count: active.length },
    { value: "archived", label: "Archived", count: all.length - active.length },
  ];

  const lifecycle = useMutation({
    mutationFn: (supplier: Supplier) =>
      supplier.status === "ACTIVE" ? archiveSupplier(supplier.id) : reactivateSupplier(supplier.id),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.suppliers.all });
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.reorder.all });
      showToast(
        updated.status === "ACTIVE"
          ? `${updated.name} is active again and appears when receiving stock.`
          : `${updated.name} archived. It no longer appears when receiving stock; its history is kept.`,
        "success",
      );
    },
    onError: (error) => showToast(describeError(error), "error"),
  });

  function closeDialog() {
    setDialog({ kind: "closed" });
  }

  function handleUseExisting(existing: { id: string; name: string }) {
    closeDialog();
    setQuery("");
    setFilter("all");
    setExpandedId(existing.id);
    showToast(`Using the existing supplier ${existing.name}.`, "info");
  }

  // The server names only the id a merged supplier went into; the list already holds that supplier.
  const nameOf = (supplierId: string | null) => all.find((supplier) => supplier.id === supplierId)?.name ?? null;

  const columns: TableColumn<Supplier>[] = [
    {
      key: "name",
      header: "Supplier",
      role: "primary",
      cell: (supplier) => (
        <ExpandToggle
          supplier={supplier}
          expanded={expandedId === supplier.id}
          onToggle={() => setExpandedId(expandedId === supplier.id ? null : supplier.id)}
        />
      ),
    },
    { key: "contact", header: "Contact", cell: (supplier) => <Contact supplier={supplier} /> },
    { key: "products", header: "Linked products", cell: (supplier) => supplier.productCount },
    {
      key: "status",
      header: "Status",
      role: "secondary",
      cell: (supplier) => <SupplierStatusCell supplier={supplier} mergedIntoName={nameOf(supplier.mergedIntoId)} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (supplier) => (
        <SupplierActions
          supplier={supplier}
          busy={lifecycle.isPending && lifecycle.variables?.id === supplier.id}
          onEdit={() => setDialog({ kind: "edit", supplier })}
          onToggleArchive={() => lifecycle.mutate(supplier)}
          onMerge={() => setDialog({ kind: "merge", duplicate: supplier })}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description={`${active.length} active, ${all.length - active.length} archived. Archived suppliers are hidden when receiving stock, but their history is kept.`}
        action={
          <>
            <Button
              variant="secondary"
              icon={<GitMerge className="size-4" aria-hidden />}
              disabled={active.length < 2}
              onClick={() => setDialog({ kind: "merge" })}
            >
              Merge suppliers
            </Button>
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setDialog({ kind: "add" })}>
              Add supplier
            </Button>
          </>
        }
      />

      <PageToolbar>
        <SearchInput label="Search suppliers" placeholder="Search by name, phone or email" onSearch={setQuery} className="w-full sm:w-80" />
        <FilterChips label="Supplier status" options={statusChips} value={filter} onChange={(next) => setFilter(next ?? "all")} />
      </PageToolbar>

      <ResponsiveTable
        label="Suppliers"
        columns={columns}
        rows={visible}
        getRowKey={(supplier) => supplier.id}
        loading={suppliers.isLoading}
        refreshing={suppliers.isFetching && !suppliers.isLoading}
        errorMessage={suppliers.isError ? describeError(suppliers.error) : null}
        onRetry={() => void suppliers.refetch()}
        renderExpanded={(supplier) => (expandedId === supplier.id ? <SupplierReceiptsList supplierId={supplier.id} /> : null)}
        empty={
          all.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              description="Add the companies you receive stock from. They are picked from a list on every receipt."
              action={<Button onClick={() => setDialog({ kind: "add" })}>Add supplier</Button>}
            />
          ) : (
            <EmptyState icon={Truck} title="No suppliers match" description="Try a different search or status filter." />
          )
        }
      />

      {(dialog.kind === "add" || dialog.kind === "edit") && (
        <SupplierDialog
          supplier={dialog.kind === "edit" ? dialog.supplier : undefined}
          onClose={closeDialog}
          onUseExisting={handleUseExisting}
          onSaved={(saved) => {
            closeDialog();
            showToast(dialog.kind === "edit" ? `Changes to ${saved.name} saved.` : `${saved.name} added. It now appears when receiving stock.`, "success");
          }}
        />
      )}

      {dialog.kind === "merge" && (
        <MergeSuppliersDialog
          suppliers={active}
          initialDuplicate={dialog.duplicate}
          onClose={closeDialog}
          onMerged={(kept, mergedAway) => {
            closeDialog();
            setExpandedId(kept.id);
            showToast(`${mergedAway.name} merged into ${kept.name}.`, "success");
          }}
        />
      )}
    </div>
  );
}

interface ExpandToggleProps {
  supplier: Supplier;
  expanded: boolean;
  onToggle: () => void;
}

function ExpandToggle({ supplier, expanded, onToggle }: ExpandToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-left font-semibold text-text-primary hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <ChevronRight
        className={clsx("size-4 shrink-0 text-text-secondary transition-transform duration-150 motion-reduce:transition-none", expanded && "rotate-90")}
        aria-hidden
      />
      {supplier.name}
    </button>
  );
}

function Contact({ supplier }: { supplier: Supplier }) {
  return (
    <span className="flex flex-col">
      <span>{supplier.phone ?? "No phone"}</span>
      <span className="break-all text-text-secondary">{supplier.email ?? "No email"}</span>
    </span>
  );
}

function SupplierStatusCell({ supplier, mergedIntoName }: { supplier: Supplier; mergedIntoName: string | null }) {
  const active = supplier.status === "ACTIVE";
  return (
    <span className="flex flex-col items-start gap-1">
      <StatusPill tone={active ? "success" : "neutral"}>{active ? "Active" : "Archived"}</StatusPill>
      {mergedIntoName && <span className="text-[12px] text-text-secondary">Merged into {mergedIntoName}</span>}
    </span>
  );
}

interface SupplierActionsProps {
  supplier: Supplier;
  busy: boolean;
  onEdit: () => void;
  onToggleArchive: () => void;
  onMerge: () => void;
}

function SupplierActions({ supplier, busy, onEdit, onToggleArchive, onMerge }: SupplierActionsProps) {
  const active = supplier.status === "ACTIVE";
  const archiveLabel = active ? "Archive" : "Reactivate";
  return (
    <span className="flex flex-wrap justify-end gap-1">
      <Button variant="ghost" aria-label={`Edit ${supplier.name}`} onClick={onEdit}>
        Edit
      </Button>
      <Button variant="ghost" loading={busy} aria-label={`${archiveLabel} ${supplier.name}`} onClick={onToggleArchive}>
        {archiveLabel}
      </Button>
      {active && (
        <Button variant="ghost" aria-label={`Merge ${supplier.name} into another supplier`} onClick={onMerge}>
          Merge
        </Button>
      )}
    </span>
  );
}
