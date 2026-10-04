import { useMutation } from "@tanstack/react-query";
import {
  dispensePrescriptionItem,
  markPrescriptionItemOutOfStock,
  requestSubstitution,
  returnPrescriptionItem,
  setPrescriptionItemProduct,
  type DispenseItemPayload,
  type ReturnItemPayload,
} from "@/shared/api/pharmacy";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "../../lib/problem";
import { useRefreshAfterChange } from "./dispensingKeys";

// Every per-item action shares the same success/failure handling: refresh what
// the screen shows, and tell the pharmacist plainly why a rejection happened.
function useItemMutationCallbacks(prescriptionId: string, failureMessage: string) {
  const refresh = useRefreshAfterChange();
  const { showToast } = useToast();
  return {
    onSuccess: () => refresh(prescriptionId),
    onError: (error: unknown) => showToast(describeError(error, failureMessage), "error"),
  };
}

// The caller mints the idempotency key per click: two deliberate clicks are two
// attempts, but a network retry of ONE attempt reuses its key (the same
// variables are replayed) and cannot deduct stock twice.
export function useDispenseItem(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: ({ payload, key }: { payload: DispenseItemPayload; key: string }) =>
      dispensePrescriptionItem(prescriptionId, itemId, payload, key),
    ...useItemMutationCallbacks(prescriptionId, "Couldn't dispense that item. Try again."),
  });
}

export function useMarkOutOfStock(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: (note: string) => markPrescriptionItemOutOfStock(prescriptionId, itemId, note || undefined),
    ...useItemMutationCallbacks(prescriptionId, "Couldn't mark that item out of stock. Try again."),
  });
}

export function useMapProduct(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: (productId: string) => setPrescriptionItemProduct(prescriptionId, itemId, productId),
    ...useItemMutationCallbacks(prescriptionId, "Couldn't link that product. Try again."),
  });
}

export function useRecordReturn(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: (payload: ReturnItemPayload) => returnPrescriptionItem(prescriptionId, itemId, payload),
    ...useItemMutationCallbacks(prescriptionId, "Couldn't record that return. Try again."),
  });
}

export function useRequestSubstitution(prescriptionId: string) {
  return useMutation({
    mutationFn: (request: { itemId: string; substituteProductId: string; message: string }) =>
      requestSubstitution(prescriptionId, request.itemId, request.substituteProductId, request.message),
    ...useItemMutationCallbacks(prescriptionId, "Couldn't send that request. Try again."),
  });
}
