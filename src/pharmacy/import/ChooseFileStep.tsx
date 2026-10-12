import { useRef, useState, type DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Download, FileSpreadsheet, ListChecks, Package, Upload } from "lucide-react";
import { listSupplierOptions } from "@/shared/api/pharmacyReceiving";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { downloadTextFile } from "../lib/csv";
import { pharmacyKeys } from "../lib/queryKeys";
import { MAX_ROWS, TEMPLATE_FILENAMES, readSheet, templateCsv, type TemplateKind } from "./importCsv";

export interface FileChoice {
  text: string;
  fileName: string;
  supplierId: string | null;
  invoiceNumber: string;
}

interface ChooseFileStepProps {
  initial: FileChoice;
  onRead: (choice: FileChoice) => void;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface RouteCard {
  kind: TemplateKind;
  title: string;
  text: string;
  columns: string[];
  icon: typeof Package;
  badge?: string;
}

const ROUTES: RouteCard[] = [
  {
    kind: "both",
    title: "Products and stock together",
    text: "One row per lot. Rows for products you do not have yet create them. Rows for products you already have just add stock.",
    columns: ["SKU", "Product name", "Lot", "Expiry", "Quantity"],
    icon: Package,
    badge: "Easiest",
  },
  {
    kind: "products",
    title: "Products only",
    text: "Build or extend your catalogue. Leave Quantity empty and no stock is added.",
    columns: ["SKU", "Product name", "Category", "Unit", "Pack size"],
    icon: ListChecks,
  },
  {
    kind: "stock",
    title: "Stock only",
    text: "Every product is already in Stock. Use this for a delivery.",
    columns: ["SKU", "Lot", "Expiry", "Quantity"],
    icon: FileSpreadsheet,
  },
];

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// Step 1: pick or paste the sheet, and say which supplier and invoice it belongs to (both optional).
export function ChooseFileStep({ initial, onRead }: ChooseFileStepProps) {
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initial.text);
  const [fileName, setFileName] = useState(initial.fileName);
  const [supplierId, setSupplierId] = useState(initial.supplierId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(initial.invoiceNumber);
  const [dragging, setDragging] = useState(false);

  const suppliers = useQuery({ queryKey: pharmacyKeys.suppliers.options, queryFn: listSupplierOptions, staleTime: 60_000 });
  const rowCount = readSheet(text).body.length;
  const tooMany = rowCount > MAX_ROWS;

  async function takeFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      showToast("That file is bigger than 5 MB. Split it into smaller files.", "error");
      return;
    }
    try {
      setText(await readTextFile(file));
      setFileName(file.name);
    } catch {
      showToast("Couldn't read that file. Try saving it as CSV again.", "error");
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void takeFile(event.dataTransfer.files[0]);
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="import-kinds" className="flex flex-col gap-3">
        <div>
          <h2 id="import-kinds" className="text-[17px] font-semibold text-text-primary">
            What is in your file?
          </h2>
          <p className="text-[13.5px] text-text-secondary">
            Pick one to get the right template. Or skip this: we read the file and tell each row apart on our own.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {ROUTES.map(({ kind, title, text: description, columns, icon: Icon, badge }) => (
            <Card key={kind} className="flex flex-col gap-3 p-5">
              {badge && (
                <span className="self-start rounded-full bg-brand-500 px-2.5 py-0.5 text-[12px] font-semibold text-white">{badge}</span>
              )}
              <div className="flex items-center gap-3 text-brand-600">
                <Icon className="size-5" aria-hidden />
                <h3 className="text-[15.5px] font-semibold text-text-primary">{title}</h3>
              </div>
              <p className="text-[13.5px] leading-relaxed text-text-secondary">{description}</p>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((column) => (
                  <span key={column} className="rounded-md border border-border-strong bg-surface-sunken px-2 py-0.5 font-mono text-[12px] text-text-primary">
                    {column}
                  </span>
                ))}
              </div>
              <Button
                variant="secondary"
                className="mt-auto self-start"
                icon={<Download className="size-4" aria-hidden />}
                onClick={() => downloadTextFile(TEMPLATE_FILENAMES[kind], templateCsv(kind))}
              >
                Template (.csv)
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <Card className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-4">
          <h2 className="text-[17px] font-semibold text-text-primary">Drop your file</h2>
          <label
            htmlFor="import-file"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors focus-within:ring-2 focus-within:ring-brand-400 ${
              dragging ? "border-brand-500 bg-brand-100" : "border-brand-300 bg-brand-50"
            }`}
          >
            <span className="grid size-12 place-items-center rounded-full border border-brand-200 bg-surface-raised text-brand-500">
              <Upload className="size-5" aria-hidden />
            </span>
            <span className="text-[15.5px] font-semibold text-text-primary">
              Drag a CSV here, or <span className="text-brand-600 underline">browse</span>
            </span>
            <span className="text-[13px] text-text-secondary">
              CSV, TSV or text. Up to {MAX_ROWS.toLocaleString("en-ZA")} rows and 5 MB. Excel files: save as CSV first.
            </span>
            {fileName && <span className="text-[13.5px] font-medium text-brand-700">{fileName}</span>}
          </label>
          <input
            id="import-file"
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="sr-only"
            onChange={(event) => void takeFile(event.target.files?.[0])}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="import-paste" className="text-[13px] font-medium text-text-primary">
              Or paste rows straight from Excel or Google Sheets
            </label>
            <textarea
              id="import-paste"
              rows={6}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setFileName("");
              }}
              spellCheck={false}
              className="w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 font-mono text-[13px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <p aria-live="polite" className={`text-[13px] ${tooMany ? "text-danger-600" : "text-text-secondary"}`}>
              {tooMany
                ? `${rowCount.toLocaleString("en-ZA")} rows is too many. Split the file into parts of ${MAX_ROWS.toLocaleString("en-ZA")} or fewer.`
                : `${rowCount} ${rowCount === 1 ? "row" : "rows"} found. Nothing is saved yet.`}
            </p>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <h2 className="text-[17px] font-semibold text-text-primary">Delivery details</h2>
          <p className="text-[13px] text-text-secondary">
            Both are optional. They apply to every row that does not have its own Supplier or Invoice column value.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="import-supplier" className="text-[13px] font-medium text-text-primary">
              Supplier
            </label>
            <select
              id="import-supplier"
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className="h-11 rounded-lg border border-border-strong bg-surface-raised px-3 text-[14.5px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              <option value="">No supplier</option>
              {(suppliers.data ?? []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="import-invoice" className="text-[13px] font-medium text-text-primary">
              Invoice number
            </label>
            <input
              id="import-invoice"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value)}
              className="h-11 rounded-lg border border-border-strong bg-surface-raised px-3 text-[14.5px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <ul className="flex flex-col gap-2 text-[13px] text-text-secondary">
            <li>We check every row first and show you what will happen.</li>
            <li>Good rows go in even if you leave a problem row out.</li>
            <li>For 24 hours, one click undoes the whole import.</li>
          </ul>
          <Button
            size="lg"
            disabled={rowCount === 0 || tooMany}
            icon={<ArrowRight className="size-4" aria-hidden />}
            onClick={() => onRead({ text, fileName, supplierId: supplierId || null, invoiceNumber: invoiceNumber.trim() })}
          >
            Read my file
          </Button>
        </aside>
      </Card>
    </div>
  );
}
