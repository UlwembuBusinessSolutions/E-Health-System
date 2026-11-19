import { Pencil, Trash2 } from "lucide-react";
import { StatusPill } from "@/shared/components/StatusPill";
import { shortfallOf, type Entry } from "./entries";

interface EntriesTableProps {
  entries: Entry[];
  editingKey: string | null;
  onEdit: (entry: Entry) => void;
  onRemove: (entry: Entry) => void;
}

const HEADERS = ["#", "Medicine / strength", "Dose", "Route", "Frequency", "Duration", "Quantity", "Supply", "Actions"];

// Step 2: one row per medicine, in the order they were entered, so the whole prescription can be
// read at a glance before signing.
export function EntriesTable({ entries, editingKey, onEdit, onRemove }: EntriesTableProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-surface-sunken/50 px-5 py-8 text-center">
        <p className="text-[14.5px] font-semibold text-text-primary">Your prescription starts here</p>
        <p className="mt-1 text-[13.5px] text-text-secondary">Add a medicine above. Each entry appears as a row for review.</p>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Entered medicines, scroll sideways on small screens"
      className="overflow-x-auto rounded-xl border border-border-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <table className="w-full min-w-[44rem] border-collapse text-left text-[14px]">
        <caption className="sr-only">Medicines entered for this visit</caption>
        <thead>
          <tr className="bg-surface-sunken text-[12.5px] text-text-secondary">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-2.5 py-2.5 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const overShelf = shortfallOf(entries, entry) > 0;
            return (
              <tr key={entry.key} className={`border-t border-border-subtle align-top ${entry.key === editingKey ? "bg-brand-50" : entry.supply === "BUY" ? "bg-surface-sunken/40" : ""}`}>
                <td className="px-2.5 py-3 tabular-nums text-text-secondary">{index + 1}</td>
                <th scope="row" className="px-2.5 py-3 text-left font-semibold text-text-primary">
                  {entry.name}
                  <div className="text-[12.5px] font-normal text-text-secondary">{entry.strengthForm}</div>
                  {entry.instructions && <div className="mt-0.5 text-[12.5px] font-normal text-text-secondary">{entry.instructions}</div>}
                </th>
                <td className="px-2.5 py-3">{entry.dose}</td>
                <td className="px-2.5 py-3">{entry.route}</td>
                <td className="px-2.5 py-3">{entry.frequency}</td>
                <td className="px-2.5 py-3">{entry.duration}</td>
                <td className="px-2.5 py-3 font-semibold tabular-nums">
                  {entry.quantity} <span className="font-normal text-text-secondary">{entry.unit}</span>
                </td>
                <td className="px-2.5 py-3">
                  {overShelf ? (
                    <StatusPill tone="danger">Over the shelf</StatusPill>
                  ) : entry.supply === "PHARMACY" ? (
                    <StatusPill tone="success">Pharmacy</StatusPill>
                  ) : (
                    <StatusPill tone="neutral">Patient buys</StatusPill>
                  )}
                </td>
                <td className="px-2.5 py-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(entry)}
                      aria-label={`Edit ${entry.name}`}
                      className="grid size-11 place-items-center rounded-lg text-text-secondary hover:bg-surface-sunken hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(entry)}
                      aria-label={`Remove ${entry.name}`}
                      className="grid size-11 place-items-center rounded-lg text-text-secondary hover:bg-danger-50 hover:text-danger-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
