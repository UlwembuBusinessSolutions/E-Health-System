import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCountSetup, startCount } from "@/shared/api/pharmacyCounts";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Switch } from "@/shared/components/Switch";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "../lib/problem";
import { pharmacyKeys } from "../lib/queryKeys";
import { DraftCountsList } from "./DraftCountsList";
import { PastCountsList } from "./PastCountsList";
import { INITIAL_SCOPE, isScopeComplete, toStartPayload, type ScopeChoice } from "./scopeChoice";
import { ScopePicker } from "./ScopePicker";

interface SetupStepProps {
  facilityId: string;
  onCountReady: (countId: string) => void;
}

export function SetupStep({ facilityId, onCountReady }: SetupStepProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<ScopeChoice>(INITIAL_SCOPE);
  // Blind by default: counting what you see, not what you expect, is the point.
  const [blind, setBlind] = useState(true);

  const setup = useQuery({
    queryKey: pharmacyKeys.counts.setup(facilityId),
    queryFn: () => getCountSetup(facilityId),
    enabled: facilityId !== "",
    staleTime: 60_000,
  });

  const start = useMutation({
    mutationFn: () => startCount(toStartPayload(choice, facilityId, blind)),
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: pharmacyKeys.counts.list(facilityId, "DRAFT") });
      onCountReady(count.id);
    },
    onError: (error) => showToast(describeError(error, "Couldn't start the count. Try again."), "error"),
  });

  return (
    <div className="flex flex-col gap-8">
      <DraftCountsList facilityId={facilityId} onResume={onCountReady} />

      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary">What are you counting?</h2>
          <p className="mt-1 text-[13.5px] text-text-secondary">
            Smaller counts are faster and easier to get right. Count one shelf area at a time if you can.
          </p>
        </div>

        <ScopePicker choice={choice} setup={setup.data} onChange={setChoice} />

        <div className="flex items-start justify-between gap-4 rounded-xl bg-surface-sunken p-4">
          <div>
            <p className="text-[14px] font-semibold text-text-primary">Blind count</p>
            <p className="text-[13px] text-text-secondary">
              Hide what the system expects while you count, so you count what you see, not what you expect.
            </p>
          </div>
          <Switch checked={blind} onChange={setBlind} label="Blind count" />
        </div>
        <p className="text-[13px] text-text-secondary">
          Dispensing can carry on while you count. Anything dispensed after you start is already taken off the system
          quantity, so it won&apos;t show up as a difference.
        </p>

        <div className="flex justify-end">
          <Button size="lg" disabled={!isScopeComplete(choice)} loading={start.isPending} onClick={() => start.mutate()}>
            Start count
          </Button>
        </div>
      </Card>

      <PastCountsList facilityId={facilityId} />
    </div>
  );
}
