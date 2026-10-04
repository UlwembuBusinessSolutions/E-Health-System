import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { downloadTextFile } from "../lib/csv";
import { rowsFromText, TEMPLATE_FILENAME, templateCsv } from "./openingCsv";
import type { OpeningStockRow } from "@/shared/api/pharmacyPlanning";

interface UploadStepProps {
  initialText: string;
  onCheck: (text: string, rows: OpeningStockRow[]) => void;
}

const COLUMN_HELP = [
  ["SKU", "Must match a product already in Stock. Example AMOX-500-CAP."],
  ["Lot", "The batch number on the box. Each lot once per product. Example AX2388."],
  ["Expiry", "Year-month-day, still in the future. Example 2027-06-30."],
  ["Quantity", "A whole number above zero, in the product's unit. Example 240."],
];

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function UploadStep({ initialText, onCheck }: UploadStepProps) {
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialText);
  const [fileName, setFileName] = useState("");
  const rows = rowsFromText(text);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setText(await readTextFile(file));
      setFileName(file.name);
    } catch {
      showToast("Couldn't read that file. Try saving it as CSV again.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <h2 className="text-[16px] font-semibold text-text-primary">Start from the template</h2>
          <p className="text-[13.5px] text-text-secondary">
            One row per lot on the shelf. Keep the header row exactly as it is. When you save it from Excel, choose CSV
            (comma delimited).
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={() => downloadTextFile(TEMPLATE_FILENAME, templateCsv())}>
            Download CSV template
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose a filled-in file"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button icon={<Upload className="size-4" aria-hidden />} onClick={() => fileInput.current?.click()}>
            Add your filled-in file
          </Button>
          {fileName && <span className="self-center text-[13.5px] text-text-secondary">{fileName}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="opening-paste" className="text-[13px] font-medium text-text-primary">
            Or paste the rows here
          </label>
          <textarea
            id="opening-paste"
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            className="w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 font-mono text-[13.5px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <p aria-live="polite" className="text-[13px] text-text-secondary">
            {rows.length} rows ready to check. Nothing is saved yet.
          </p>
        </div>
        <div className="flex justify-end">
          <Button size="lg" disabled={rows.length === 0} onClick={() => onCheck(text, rows)}>
            Check rows
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-[15px] font-semibold text-text-primary">The four columns</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {COLUMN_HELP.map(([name, help]) => (
            <div key={name}>
              <dt className="text-[13.5px] font-semibold text-text-primary">{name} <span className="font-normal text-text-secondary">(required)</span></dt>
              <dd className="text-[13px] text-text-secondary">{help}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 rounded-lg bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-600">
          Opening stock can be loaded one time only. Count the shelf first.
        </p>
      </Card>
    </div>
  );
}
