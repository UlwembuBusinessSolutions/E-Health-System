import { useMutation } from "@tanstack/react-query";
import { collectPrescription, uploadCollectionProof, type CollectPayload } from "@/shared/api/pharmacy";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError, isWitnessRequired } from "../../lib/problem";
import { useRefreshAfterChange } from "./useRefreshAfterChange";

interface CollectRequest {
  /** Sent as is, apart from `proofRef`, which this hook fills in from `proof`. */
  payload: CollectPayload;
  /** Written authorisation from a third party, uploaded before the hand-over is recorded. */
  proof?: File;
}

export function useCollect(prescriptionId: string) {
  const refresh = useRefreshAfterChange();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: async ({ payload, proof }: CollectRequest) => {
      const proofRef = proof ? await uploadCollectionProof(prescriptionId, proof) : payload.proofRef;
      return collectPrescription(prescriptionId, { ...payload, proofRef });
    },
    // The card may leave the queue the moment the refresh lands, taking the
    // drawer's own confirmation with it, so confirm here as well.
    onSuccess: () => {
      refresh();
      showToast("Collection recorded.", "success");
    },
    // A missing witness is not a failure to report: the drawer asks for one instead.
    onError: (error) => {
      if (!isWitnessRequired(error)) showToast(describeError(error, "Couldn't confirm the collection. Try again."), "error");
    },
  });
}
