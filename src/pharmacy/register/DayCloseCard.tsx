import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { closeDay, getDayClose, type DayClose, type ScheduledProduct } from "@/shared/api/pharmacyRegister";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";
import { Input } from "@/shared/components/Input";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { ErrorState } from "../components/ErrorState";
import { SkeletonRows } from "../components/SkeletonRows";
import { formatDate, formatDateTime } from "../lib/format";
import { describeError } from "../lib/problem";
import { canCloseDay, expectedBalance, MIN_VARIANCE_REASON_LENGTH, varianceOf } from "./registerMath";
import { pharmacyKeys } from "../lib/queryKeys";

interface DayCloseCardProps {
  facilityId: string;
  product: ScheduledProduct;
  /** Business date being closed, `YYYY-MM-DD`. */
  date: string;
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[12.5px] text-text-secondary">{label}</dt>
      <dd className="text-[18px] font-semibold tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

function describeVariance(variance: number): string {
  if (variance === 0) return "Balances";
  return variance < 0 ? `${Math.abs(variance)} missing` : `${variance} extra`;
}

function ClosedSummary({ close }: { close: DayClose }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl bg-surface-sunken p-4 text-[13.5px]">
      <Lock className="mt-0.5 size-4 shrink-0 text-text-secondary" aria-hidden />
      <div>
        <p className="font-semibold text-text-primary">
          Day closed: counted {close.counted}, {describeVariance(close.variance ?? 0).toLowerCase()}.
        </p>
        {close.varianceReason && <p className="text-text-secondary">Reason: {close.varianceReason}</p>}
        <p className="text-text-secondary">
          Signed by {close.closedByName}
          {close.closedAt && ` on ${formatDateTime(close.closedAt)}`}. It cannot be changed.
        </p>
      </div>
    </div>
  );
}

export function DayCloseCard({ facilityId, product, date }: DayCloseCardProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const key = pharmacyKeys.register.dayClose(facilityId, product.productId, date);

  const dayClose = useQuery({ queryKey: key, queryFn: () => getDayClose(facilityId, product.productId, date) });
  const sign = useMutation({
    mutationFn: (close: DayClose) =>
      closeDay({
        facilityId,
        productId: product.productId,
        date,
        countedQuantity: Number(counted),
        varianceReason: varianceOf(Number(counted), expectedBalance(close)) === 0 ? undefined : reason.trim(),
      }),
    onSuccess: (closed) => {
      queryClient.setQueryData(key, closed);
      showToast("Day closed and signed.", "success");
    },
    onError: (error) => showToast(describeError(error), "error"),
  });

  const close = dayClose.data;
  const hasCount = counted.trim() !== "";
  const variance = close && hasCount ? varianceOf(Number(counted), expectedBalance(close)) : null;
  const ready = variance !== null && canCloseDay(variance, reason);

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-[16px] font-semibold text-text-primary">Daily reconciliation</h2>
        <p className="text-[13px] text-text-secondary">
          {formatDate(date)} &middot; {product.productName}
        </p>
      </div>

      {dayClose.isLoading && <SkeletonRows rows={2} />}
      {dayClose.error && <ErrorState message={describeError(dayClose.error)} onRetry={() => void dayClose.refetch()} />}

      {close && (
        <>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Figure label="Opening balance" value={close.opening} />
            <Figure label="Dispensed" value={close.dispensed} />
            <Figure label="Received" value={close.received} />
            <Figure label="Destroyed, lost or returned" value={close.destroyed + close.lost + close.returned} />
            <Figure label="Expected" value={expectedBalance(close)} />
          </dl>

          {close.closed ? (
            <ClosedSummary close={close} />
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (ready) sign.mutate(close);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Counted on the shelf"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={counted}
                  onChange={(event) => setCounted(event.target.value.replace(/\D/g, ""))}
                />
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-medium text-text-primary">Variance</span>
                  <p aria-live="polite" className="flex h-11 items-center text-[15px] font-semibold tabular-nums text-text-primary">
                    {variance === null ? "—" : describeVariance(variance)}
                  </p>
                </div>
              </div>
              {variance !== null && variance !== 0 && (
                <Input
                  label="Reason for the variance"
                  required
                  value={reason}
                  hint={`At least ${MIN_VARIANCE_REASON_LENGTH} characters.`}
                  onChange={(event) => setReason(event.target.value)}
                />
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={!ready} loading={sign.isPending}>
                  Sign and close day
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </Card>
  );
}
