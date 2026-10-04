import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cancelCount, listCounts, type CountSummary } from "@/shared/api/pharmacyCounts";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatDateTime, pluralise } from "../lib/format";
import { describeError } from "../lib/problem";
import { countKeys } from "./countKeys";

interface DraftCountsListProps {
  facilityId: string;
  onResume: (countId: string) => void;
}

// Counts that were saved to continue later. They only appear when there is
// something to resume, so a fresh facility never sees an empty heading.
export function DraftCountsList({ facilityId, onResume }: DraftCountsListProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [discarding, setDiscarding] = useState<CountSummary | null>(null);

  const drafts = useQuery({
    queryKey: countKeys.list(facilityId, "DRAFT"),
    queryFn: () => listCounts(facilityId, "DRAFT"),
    enabled: facilityId !== "",
    staleTime: 15_000,
  });

  const discard = useMutation({
    mutationFn: (countId: string) => cancelCount(countId),
    onSuccess: () => {
      setDiscarding(null);
      showToast("Count discarded. Stock was not changed.", "success");
      return queryClient.invalidateQueries({ queryKey: countKeys.list(facilityId, "DRAFT") });
    },
    onError: (error) => showToast(describeError(error), "error"),
  });

  const items = drafts.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="drafts-heading" className="flex flex-col gap-3">
      <h2 id="drafts-heading" className="text-[15px] font-semibold text-text-primary">
        Counts in progress
      </h2>
      <ul className="flex flex-col gap-3">
        {items.map((draft) => (
          <li key={draft.id}>
            <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[14.5px] font-semibold text-text-primary">
                  {draft.reference} &middot; {draft.scopeLabel}
                </p>
                <p className="text-[13px] text-text-secondary">
                  Started {formatDateTime(draft.startedAt)} by {draft.startedByName} &middot; {draft.lotsCounted} of{" "}
                  {pluralise(draft.totalLots, "lot")} counted
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setDiscarding(draft)}>
                  Discard
                </Button>
                <Button onClick={() => onResume(draft.id)}>Resume</Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={discarding !== null}
        tone="danger"
        title="Discard this count?"
        body="Your counted numbers will be thrown away. Nothing has been posted, so stock stays exactly as it is."
        confirmLabel="Discard count"
        loading={discard.isPending}
        onConfirm={() => discarding && discard.mutate(discarding.id)}
        onCancel={() => setDiscarding(null)}
      />
    </section>
  );
}
