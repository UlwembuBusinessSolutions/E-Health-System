import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { DispenseItemPayload, Prescription, PrescriptionItem, ProductRef, WitnessCredentials } from "@/shared/api/pharmacy";
import { describeError, isWitnessRequired } from "../lib/problem";
import { useDispenseItem, useMapProduct, useMarkOutOfStock, useRecordReturn } from "./hooks/useItemMutations";
import { ChangeLotPicker } from "./ChangeLotPicker";
import { ItemActions, type ItemPanel } from "./ItemActions";
import { ItemBadges, itemStatusNote } from "./ItemBadges";
import { activeLot, isMapped, lotAdvice, returnableQuantity, suggestedProductOf } from "./itemState";
import { OutOfStockForm } from "./OutOfStockForm";
import { PartialDispenseForm } from "./PartialDispenseForm";
import { ProductPicker } from "./ProductPicker";
import { RecordReturnForm } from "./RecordReturnForm";
import { StockLine } from "./StockLine";
import { SubstitutionAnswer } from "./SubstitutionAnswer";
import { SubstitutionPanel } from "./SubstitutionPanel";
import { WitnessDialog } from "./WitnessDialog";

interface ItemRowProps {
  prescription: Prescription;
  item: PrescriptionItem;
  onAskSubstitute: (item: PrescriptionItem, substitute: ProductRef) => void;
}

// One medicine line. Owns which small form is open and which lot is picked;
// everything that talks to the server goes through the item mutation hooks.
export function ItemRow({ prescription, item, onAskSubstitute }: ItemRowProps) {
  const [panel, setPanel] = useState<ItemPanel | null>(null);
  const [chosenBatchId, setChosenBatchId] = useState<string | null>(null);
  // The dispense the server refused for lack of a witness, kept so it can be sent again with one.
  const [needsWitness, setNeedsWitness] = useState<DispenseItemPayload | null>(null);

  const dispense = useDispenseItem(prescription.id, item.id);
  const markOutOfStock = useMarkOutOfStock(prescription.id, item.id);
  const mapProduct = useMapProduct(prescription.id, item.id);
  const recordReturn = useRecordReturn(prescription.id, item.id);

  const lot = activeLot(item, chosenBatchId);
  const advice = lotAdvice(item, lot);
  const statusNote = itemStatusNote(item);
  const closePanel = () => setPanel(null);

  function sendDispense(payload: DispenseItemPayload, onDone?: () => void) {
    dispense.mutate(payload, {
      onSuccess: () => {
        setNeedsWitness(null);
        onDone?.();
      },
      onError: (error) => {
        if (isWitnessRequired(error)) setNeedsWitness(payload);
      },
    });
  }

  function dispenseWhole() {
    sendDispense({ quantity: item.remainingQuantity, batchId: lot?.batchId });
  }

  function dispensePart(quantity: number) {
    sendDispense({ quantity, batchId: lot?.batchId }, closePanel);
  }

  function dispenseWitnessed(witness: WitnessCredentials) {
    if (needsWitness) sendDispense({ ...needsWitness, ...witness }, closePanel);
  }

  return (
    <li className="rounded-lg border border-border-subtle bg-surface-sunken/40 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <p className="min-w-0 text-[14.5px] font-medium text-text-primary">
          {item.dispensingProductName ?? item.mappedProductName ?? item.drugName}
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
          suggestion={suggestedProductOf(item)}
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

      {item.substitutionStatus === "REQUESTED" && (
        <SubstitutionAnswer prescriptionId={prescription.id} itemId={item.id} substituteName={item.substituteProductName} />
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
      {panel === "substitute" && (
        <SubstitutionPanel
          drugName={item.drugName}
          onAskPrescriber={(substitute) => {
            onAskSubstitute(item, substitute);
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
      {needsWitness && (
        <WitnessDialog
          facilityId={prescription.facilityId}
          pending={dispense.isPending}
          errorMessage={dispense.isError && !isWitnessRequired(dispense.error) ? describeError(dispense.error) : null}
          onConfirm={dispenseWitnessed}
          onCancel={() => setNeedsWitness(null)}
        />
      )}
    </li>
  );
}
