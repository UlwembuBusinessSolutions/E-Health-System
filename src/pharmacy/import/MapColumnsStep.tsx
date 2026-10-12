import { ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { StatusPill } from "@/shared/components/StatusPill";
import {
  FIELDS,
  FIELD_LABELS,
  FILE_KIND_LABELS,
  describeFile,
  type ColumnFields,
  type FieldKey,
  type MatchQuality,
  type ReadSheet,
} from "./importCsv";

interface MapColumnsStepProps {
  sheet: ReadSheet;
  fileName: string;
  columns: ColumnFields;
  quality: MatchQuality[];
  onColumnsChange: (columns: ColumnFields) => void;
  onBack: () => void;
  onContinue: () => void;
}

const SAMPLE_ROWS = 3;

function sampleOf(sheet: ReadSheet, column: number): string {
  const values = sheet.body.slice(0, SAMPLE_ROWS).map((row) => row[column]).filter((value) => value);
  return values.join(", ") || "(empty)";
}

// Step 2: say which column of the file is which field. Obvious headings are matched already.
export function MapColumnsStep({ sheet, fileName, columns, quality, onColumnsChange, onBack, onContinue }: MapColumnsStepProps) {
  const kind = describeFile(columns);
  const canContinue = columns.includes("sku");
  const usedTwice = FIELDS.filter((field) => columns.filter((chosen) => chosen === field.key).length > 1);

  function choose(index: number, field: FieldKey | "") {
    // A field can only come from one column, so picking it here frees it from any other.
    onColumnsChange(columns.map((current, i) => (i === index ? field : current === field ? "" : current)));
  }

  return (
    <Card className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary">We matched your columns</h2>
          <p className="text-[13.5px] text-text-secondary">
            {fileName || "Pasted rows"} · {sheet.body.length} {sheet.body.length === 1 ? "row" : "rows"} · {sheet.headings.length} columns.
            {sheet.hadHeadingRow ? " Change any that look wrong." : " There is no heading row, so we used the template order."}
          </p>
        </div>
        <p role="status" className="rounded-xl bg-brand-50 px-3.5 py-2 text-[13.5px] font-semibold text-brand-700">
          {kind === "unknown" ? "Choose the SKU column to continue" : `Looks like: ${FILE_KIND_LABELS[kind]}`}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[14px]">
          <thead>
            <tr className="text-[12.5px] text-text-secondary">
              <th scope="col" className="px-3 py-2 font-semibold">Your column</th>
              <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">First values</th>
              <th scope="col" className="px-3 py-2 font-semibold">Goes into</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Match</th>
            </tr>
          </thead>
          <tbody>
            {sheet.headings.map((heading, index) => (
              <tr key={index} className="border-t border-border-subtle">
                <td className="px-3 py-2.5">
                  <span className="break-all rounded-md border border-border-subtle bg-surface-sunken px-2 py-0.5 font-mono text-[13px]">{heading || `Column ${index + 1}`}</span>
                </td>
                <td className="hidden max-w-64 truncate px-3 py-2.5 text-[13px] text-text-secondary md:table-cell">{sampleOf(sheet, index)}</td>
                <td className="px-3 py-2.5">
                  <label className="sr-only" htmlFor={`column-${index}`}>
                    Field for {heading || `column ${index + 1}`}
                  </label>
                  <select
                    id={`column-${index}`}
                    value={columns[index] ?? ""}
                    onChange={(event) => choose(index, event.target.value as FieldKey | "")}
                    className="h-11 w-full min-w-0 rounded-lg sm:min-w-44 border border-border-strong bg-surface-raised px-3 text-[14.5px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                  >
                    <option value="">Not used</option>
                    {FIELDS.map((field) => (
                      <option key={field.key} value={field.key}>
                        {FIELD_LABELS[field.key]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {columns[index] === "" ? (
                    <StatusPill tone="neutral">Skipped</StatusPill>
                  ) : quality[index] === "exact" ? (
                    <StatusPill tone="success">Exact</StatusPill>
                  ) : quality[index] === "guess" ? (
                    <StatusPill tone="success">Good guess</StatusPill>
                  ) : (
                    <StatusPill tone="warning">Your choice</StatusPill>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {usedTwice.length > 0 && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-600">
          More than one column goes into {usedTwice.map((field) => field.label).join(", ")}.
        </p>
      )}
      {!canContinue && (
        <p role="alert" className="rounded-lg bg-danger-50 px-3.5 py-2.5 text-[13px] text-danger-600">
          Every row needs a SKU. Pick which column holds it.
        </p>
      )}

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" disabled={!canContinue} icon={<ArrowRight className="size-4" aria-hidden />} onClick={onContinue}>
          Check my rows
        </Button>
      </div>
    </Card>
  );
}
