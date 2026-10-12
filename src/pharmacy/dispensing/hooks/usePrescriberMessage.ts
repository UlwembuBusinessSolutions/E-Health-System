import { useMutation } from "@tanstack/react-query";
import { sendPrescriberMessage } from "@/shared/api/pharmacy";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "../../lib/problem";

export function useSendPrescriberMessage(prescriptionId: string) {
  const { showToast } = useToast();
  return useMutation({
    mutationFn: (message: string) => sendPrescriberMessage(prescriptionId, message),
    onError: (error) => showToast(describeError(error, "Couldn't send that message. Try again."), "error"),
  });
}
