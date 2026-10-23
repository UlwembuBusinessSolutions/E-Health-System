import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ImportResult, ImportRow } from "@/shared/api/pharmacyImport";
import { PageHeader } from "@/shared/components/PageHeader";
import { FacilityField } from "../components/FacilityField";
import { StepIndicator } from "../components/StepIndicator";
import { invalidateAfterStockMovement, pharmacyKeys } from "../lib/queryKeys";
import { useFacilitySelection } from "../lib/useFacilitySelection";
import { CheckStep } from "./CheckStep";
import { ChooseFileStep, type FileChoice } from "./ChooseFileStep";
import { DoneStep } from "./DoneStep";
import { MapColumnsStep } from "./MapColumnsStep";
import { RecentImports } from "./RecentImports";
import { guessColumns, readSheet, rowsFromSheet, type ColumnFields, type LeftOutRow, type MatchQuality, type ReadSheet } from "./importCsv";

type Stage = "choose" | "map" | "check" | "done";

const STEPS = ["Choose file", "Match columns", "Check rows", "Done"];
const STEP_INDEX: Record<Stage, number> = { choose: 0, map: 1, check: 2, done: 3 };

const EMPTY_CHOICE: FileChoice = { text: "", fileName: "", supplierId: null, invoiceNumber: "" };

// `/app/pharmacy/import`: bring products and stock in from a spreadsheet.
export function ImportPage() {
  const queryClient = useQueryClient();
  const { facilityId, facilities, selectFacility } = useFacilitySelection();
  const [stage, setStage] = useState<Stage>("choose");
  const [choice, setChoice] = useState<FileChoice>(EMPTY_CHOICE);
  const [sheet, setSheet] = useState<ReadSheet | null>(null);
  const [columns, setColumns] = useState<ColumnFields>([]);
  const [quality, setQuality] = useState<MatchQuality[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [leftOut, setLeftOut] = useState<LeftOutRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  function readFile(next: FileChoice) {
    const read = readSheet(next.text);
    const guessed = guessColumns(read);
    setChoice(next);
    setSheet(read);
    setColumns(guessed.columns);
    setQuality(guessed.quality);
    setStage("map");
  }

  function checkRows() {
    if (!sheet) return;
    setRows(rowsFromSheet(sheet.body, columns));
    setLeftOut([]);
    setStage("check");
  }

  function editRow(index: number, changes: Partial<ImportRow>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...changes } : row)));
  }

  function skipRow(index: number, reason: string) {
    setLeftOut((current) => [...current, { row: rows[index], reason }]);
    setRows((current) => current.filter((_, i) => i !== index));
  }

  function imported(done: ImportResult) {
    setResult(done);
    setStage("done");
    void invalidateAfterStockMovement(queryClient);
    void queryClient.invalidateQueries({ queryKey: pharmacyKeys.imports.all });
  }

  function startAnother() {
    setChoice(EMPTY_CHOICE);
    setSheet(null);
    setRows([]);
    setLeftOut([]);
    setResult(null);
    setStage("choose");
  }

  return (
    <div>
      <PageHeader
        title="Import from a spreadsheet"
        description="Add products, receive stock, or both, from a CSV. Every row is checked before anything is saved."
      />
      <FacilityField facilities={facilities} value={facilityId} onChange={selectFacility} />
      <StepIndicator steps={STEPS} current={STEP_INDEX[stage]} />

      {stage === "choose" && (
        <div className="flex flex-col gap-8">
          <ChooseFileStep initial={choice} onRead={readFile} />
          <RecentImports facilityId={facilityId} />
        </div>
      )}
      {stage === "map" && sheet && (
        <MapColumnsStep
          sheet={sheet}
          fileName={choice.fileName}
          columns={columns}
          quality={quality}
          onColumnsChange={setColumns}
          onBack={() => setStage("choose")}
          onContinue={checkRows}
        />
      )}
      {stage === "check" && facilityId && (
        <CheckStep
          facilityId={facilityId}
          fileName={choice.fileName}
          supplierId={choice.supplierId}
          invoiceNumber={choice.invoiceNumber}
          rows={rows}
          onEdit={editRow}
          onSkip={skipRow}
          onBack={() => setStage("map")}
          onImported={imported}
        />
      )}
      {stage === "done" && result && <DoneStep result={result} leftOut={leftOut} onStartAnother={startAnother} />}
    </div>
  );
}
