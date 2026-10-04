import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { Prescription, PrescriptionItem, SubstituteSuggestion } from "@/shared/api/pharmacy";
import { useDispenseItem, useMapProduct, useMarkOutOfStock, useRecordReturn } from "./hooks/useItemMutations";
import { ChangeLotPicker } from "./ChangeLotPicker";
import { ItemActions, type ItemPanel } from "./ItemActions";
import { ItemBadges, itemStatusNote } from "./ItemBadges";
import { activeLot, isMapped, lotAdvice, returnableQuantity } from "./itemState";
import { OutOfStockForm } from "./OutOfStockForm";
import { PartialDispenseForm } from "./PartialDispenseForm";
import { ProductPicker } from "./ProductPicker";
import { RecordReturnForm } from "./RecordReturnForm";
import { StockLine } from "./StockLine";
import { SubstitutionPanel } from "./SubstitutionPanel";

interface ItemRowProps {
  prescription: Prescription;
  item: PrescriptionItem;
  onAskSubstitute: (item: PrescriptionItem, suggestion: SubstituteSuggestion) => void;
}

// One medicine line. Owns which small form is open and which lot is picked;
// everything that talks to the server goes through the item mutation hooks.
export function ItemRow({ prescription, item, onAskSubstitute }: ItemRowProps) {
  const [panel, setPanel] = useState<ItemPanel | null>(null);
  const [chosenBatchId, setChosenBatchId] = useState<string | null>(null);

  const dispense = useDispenseItem(prescription.id, item.id);
  const markOutOfStock = useMarkOutOfStock(prescription.id, item.id);
  const mapProduct = useMapProduct(prescription.id, item.id);
  const recordReturn = useRecordReturn(prescription.id, item.id);

  const lot = activeLot(item, chosenBatchId);
  const advice = lotAdvice(item, lot);
  const statusNote = itemStatusNote(item);
  const closePanel = () => setPanel(null);

  function dispenseWhole() {
    dispense.mutate({
      payload: { quantity: item.remainingQuantity, batchId: lot?.batchId },
      key: crypto.randomUUID(),
    });
  }

  function dispensePart(quantity: number) {
    dispense.mutate(
      { payload: { quantity, batchId: lot?.batchId }, key: crypto.randomUUID() },
      { onSuccess: closePanel },
    );
  }

  return (
    <li className="rounded-lg border border-border-subtle bg-surface-sunken/40 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 text-[14.5px] font-medium text-text-primary">
          {item.mappedProductName ?? item.drugName}
          <span className="text-text-secondary"> — {item.dosage} × {item.quantity}</span>
        </p>
        <ItemBadges item={item} />
      </div>
      <StockLine item={item} lot={lot} />
      {statusNote && <p className="mt-1.5 text-[13px] text-text-secondary">{statusNote}</p>}
      {advice && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-amber-600">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {advice}
        </p>
      )}

      {!isMapped(item) ? (
        <ProductPicker
          drugName={item.drugName}
          suggestion={item.suggestedProduct}
          loading={mapProduct.isPending}
          onConfirm={(productId) => mapProduct.mutate(productId)}
        />
      ) : (
        <ItemActions
          item={item}
          lot={lot}
          dispensing={dispense.isPending}
          activePanel={panel}
          onDispense={dispenseWhole}
          onOpenPanel={(next) => setPanel(panel === next ? null : next)}
        />
      )}

      {panel === "outOfStock" && (
        <OutOfStockForm
          initialNote={item.outOfStockNote ?? ""}
          loading={markOutOfStock.isPending}
          onConfirm={(note) => markOutOfStock.mutate(note, { onSuccess: closePanel })}
          onCancel={closePanel}
        />
      )}
      {panel === "part" && lot && (
        <PartialDispenseForm
          item={item}
          lot={lot}
          loading={dispense.isPending}
          onConfirm={dispensePart}
          onCancel={closePanel}
        />
      )}
      {panel === "lot" && (
        <ChangeLotPicker
          usableLots={item.usableLots}
          expiredLots={item.skippedExpiredLots}
          selectedBatchId={lot?.batchId ?? null}
          onSelect={setChosenBatchId}
        />
      )}
      {panel === "substitute" && item.substituteSuggestion && (
        <SubstitutionPanel
          drugName={item.drugName}
          suggestion={item.substituteSuggestion}
          onAskPrescriber={() => {
            if (item.substituteSuggestion) onAskSubstitute(item, item.substituteSuggestion);
            closePanel();
          }}
          onCancel={closePanel}
        />
      )}
      {panel === "return" && (
        <RecordReturnForm
          patientName={prescription.patientName}
          maxQuantity={returnableQuantity(item)}
          loading={recordReturn.isPending}
          onConfirm={(payload) => recordReturn.mutate(payload, { onSuccess: closePanel })}
          onCancel={closePanel}
        />
      )}
    </li>
  );
}
