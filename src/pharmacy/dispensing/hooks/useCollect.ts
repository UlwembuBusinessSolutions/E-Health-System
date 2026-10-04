import { useMutation } from "@tanstack/react-query";
import { collectPrescription, type CollectFiles, type CollectPayload } from "@/shared/api/pharmacy";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "../../lib/problem";
import { useRefreshAfterChange } from "./dispensingKeys";

interface CollectRequest {
  payload: CollectPayload;
  files: CollectFiles;
  // One key per hand-over attempt; see useDispenseItem.
  key: string;
}

export function useCollect(prescriptionId: string) {
  const refresh = useRefreshAfterChange();
  const { showToast } = useToast();
  return useMutation({
    mutationFn: ({ payload, files, key }: CollectRequest) => collectPrescription(prescriptionId, payload, files, key),
    // The card may leave the queue the moment the refresh lands, taking the
    // drawer's own confirmation with it, so confirm here as well.
    onSuccess: () => {
      refresh(prescriptionId);
      showToast("Collection recorded.", "success");
    },
    onError: (error) => showToast(describeError(error, "Couldn't confirm the collection. Try again."), "error"),
  });
}
