import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { exportBatchExpiry } from "@/shared/api/pharmacyStock";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "@/pharmacy/lib/problem";
import { useFacilitySelection } from "@/pharmacy/lib/useFacilitySelection";
import { useLedgerMovements } from "./hooks/useLedgerMovements";
import { useReceipts } from "./hooks/useReceipts";
import { LedgerTabs, type LedgerTabKey } from "./LedgerTabs";
import { MovementsTab } from "./MovementsTab";
import { ReceiptsTab } from "./ReceiptsTab";

// `/app/pharmacy/ledger`: every row is an immutable posted entry. Mistakes are
// fixed by a linked reversal, so there is deliberately no edit or delete here.
export function LedgerPage() {
  const { showToast } = useToast();
  const { facilities, facilityId, selectFacility } = useFacilitySelection();
  const [tab, setTab] = useState<LedgerTabKey>("movements");

  // One-row queries just for the totals in the tab labels; the shared
  // invalidation prefixes keep them current.
  const movementTotal = useLedgerMovements({ facilityId }, 0, 1).data?.totalItems;
  const receiptTotal = useReceipts({ facilityId }, 0, 1).data?.totalItems;

  const exportMutation = useMutation({
    mutationFn: () => exportBatchExpiry(facilityId),
    onSuccess: () => showToast("Batch/expiry report exported.", "success"),
    onError: (error) => showToast(describeError(error, "Couldn't export that report. Try again."), "error"),
  });

  return (
    <div>
      <PageHeader
        title="Ledger"
        description="Every stock movement and every delivery received, with the option to undo a mistake."
        action={
          <Button
            variant="secondary"
            icon={<Download className="size-4" aria-hidden />}
            loading={exportMutation.isPending}
            disabled={!facilityId}
            onClick={() => exportMutation.mutate()}
          >
            Export CSV
          </Button>
        }
      />
      <Select
        label="Facility"
        options={facilities.map((facility) => ({ value: facility.id, label: facility.name }))}
        value={facilityId}
        onChange={(event) => selectFacility(event.target.value)}
        className="mb-4 sm:w-64"
      />
      <LedgerTabs active={tab} onChange={setTab} counts={{ movements: movementTotal, receipts: receiptTotal }}>
        {facilityId && (tab === "movements" ? <MovementsTab facilityId={facilityId} /> : <ReceiptsTab facilityId={facilityId} />)}
      </LedgerTabs>
    </div>
  );
}
