import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addFoundLot,
  cancelCount,
  getCount,
  postCount,
  setCountedQuantity,
  setLineReason,
  type CountDetail,
  type CountLine,
  type CountReason,
  type FoundLotPayload,
} from "@/shared/api/pharmacyCounts";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "../lib/problem";
import { countKeys } from "./countKeys";

// The count lives on the server from the first number typed, so nothing here
// keeps its own copy of the lines: every action patches the cached detail with
// what the server answered, and that cache is the single source of truth.
export function useStockCount(countId: string, revealSystem: boolean) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const detailKey = countKeys.detail(countId, revealSystem);
  // One key per posting ATTEMPT so a retry after a dropped connection can
  // never post the adjustments twice.
  const postKey = useRef(crypto.randomUUID());

  const detail = useQuery({ queryKey: detailKey, queryFn: () => getCount(countId, revealSystem) });

  function replaceLine(updated: CountLine) {
    queryClient.setQueryData<CountDetail>(detailKey, (current) =>
      current && { ...current, lines: current.lines.map((line) => (line.id === updated.id ? updated : line)) },
    );
  }

  const failed = (error: unknown) => showToast(describeError(error), "error");

  const setCounted = useMutation({
    mutationFn: ({ lineId, quantity }: { lineId: string; quantity: number }) =>
      setCountedQuantity(countId, lineId, quantity),
    // The baseline moved when the line was re-stamped, so the review figures
    // have to come from the server again rather than from the local patch.
    onSuccess: (line) => {
      if (revealSystem) void queryClient.invalidateQueries({ queryKey: countKeys.detailOf(countId) });
      else replaceLine(line);
    },
    onError: failed,
  });

  const setReason = useMutation({
    mutationFn: ({ lineId, reason }: { lineId: string; reason: CountReason }) => setLineReason(countId, lineId, reason),
    onSuccess: replaceLine,
    onError: failed,
  });

  const addFound = useMutation({
    mutationFn: (payload: FoundLotPayload) => addFoundLot(countId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: countKeys.detailOf(countId) }),
    onError: failed,
  });

  const post = useMutation({
    mutationFn: () => postCount(countId, postKey.current),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: countKeys.all }),
    onError: failed,
  });

  const cancel = useMutation({
    mutationFn: () => cancelCount(countId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: countKeys.all }),
    onError: failed,
  });

  // "Remove as expired": a count of zero plus its reason, in one tap.
  async function removeAsExpired(line: CountLine) {
    try {
      await setCounted.mutateAsync({ lineId: line.id, quantity: 0 });
      await setReason.mutateAsync({ lineId: line.id, reason: "EXPIRED_REMOVED" });
    } catch {
      // Each mutation's onError has already told the person what went wrong.
    }
  }

  return { detail, setCounted, setReason, addFound, post, cancel, removeAsExpired };
}
