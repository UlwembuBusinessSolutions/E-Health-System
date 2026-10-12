import { useMutation } from "@tanstack/react-query";
import {
  decideSubstitution,
  dispensePrescriptionItem,
  markPrescriptionItemOutOfStock,
  requestSubstitution,
  returnPrescriptionItem,
  setPrescriptionItemProduct,
  type DispenseItemPayload,
  type ReturnItemPayload,
  type SubstitutionStatus,
} from "@/shared/api/pharmacy";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError, isWitnessRequired } from "../../lib/problem";
import { useRefreshAfterChange } from "./useRefreshAfterChange";

// Every per-item action shares the same success/failure handling: refresh what
// the screen shows, and tell the pharmacist plainly why a rejection happened.
// A missing witness is not a failure to report: the screen asks for one instead.
function useItemMutationCallbacks(failureMessage: string) {
  const refresh = useRefreshAfterChange();
  const { showToast } = useToast();
  return {
    onSuccess: () => refresh(),
    onError: (error: unknown) => {
      if (!isWitnessRequired(error)) showToast(describeError(error, failureMessage), "error");
    },
  };
}

// The caller disables the button while this is pending, which is what stops a
// double click deducting stock twice.
export function useDispenseItem(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: (payload: DispenseItemPayload) => dispensePrescriptionItem(prescriptionId, itemId, payload),
    ...useItemMutationCallbacks("Couldn't dispense that item. Try again."),
  });
}

export function useMarkOutOfStock(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: (note: string) => markPrescriptionItemOutOfStock(prescriptionId, itemId, note || undefined),
    ...useItemMutationCallbacks("Couldn't mark that item out of stock. Try again."),
  });
}

export function useMapProduct(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: (productId: string) => setPrescriptionItemProduct(prescriptionId, itemId, productId),
    ...useItemMutationCallbacks("Couldn't link that product. Try again."),
  });
}

export function useRecordReturn(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: (payload: ReturnItemPayload) => returnPrescriptionItem(prescriptionId, itemId, payload),
    ...useItemMutationCallbacks("Couldn't record that return. Try again."),
  });
}

export function useRequestSubstitution(prescriptionId: string) {
  return useMutation({
    mutationFn: (request: { itemId: string; substituteProductId: string; note: string }) =>
      requestSubstitution(prescriptionId, request.itemId, request.substituteProductId, request.note),
    ...useItemMutationCallbacks("Couldn't send that request. Try again."),
  });
}

export function useDecideSubstitution(prescriptionId: string, itemId: string) {
  return useMutation({
    mutationFn: (status: Extract<SubstitutionStatus, "APPROVED" | "REJECTED">) =>
      decideSubstitution(prescriptionId, itemId, status),
    ...useItemMutationCallbacks("Couldn't record the prescriber's answer. Try again."),
  });
}
