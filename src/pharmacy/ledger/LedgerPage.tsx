import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { exportBatchExpiry } from "@/shared/api/pharmacyStock";
import { getFacilities } from "@/shared/api/facilities";
import { Button } from "@/shared/components/Button";
import { Select } from "@/shared/components/Select";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";
import { describeError } from "@/pharmacy/lib/problem";
import { useLedgerMovements } from "./hooks/useLedgerMovements";
import { useReceipts } from "./hooks/useReceipts";
import { LedgerTabs, type LedgerTabKey } from "./LedgerTabs";
import { MovementsTab } from "./MovementsTab";
import { ReceiptsTab } from "./ReceiptsTab";

// `/app/pharmacy/ledger`: every row is an immutable posted entry. Mistakes are
// fixed by a linked reversal, so there is deliberately no edit or delete here.
export function LedgerPage() {
  const { showToast } = useToast();
  const [facilityId, setFacilityId] = useState("");
  const [tab, setTab] = useState<LedgerTabKey>("movements");

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  // One-row queries just for the totals in the tab labels; they share cache
  // keys with nothing else, and the invalidation prefixes keep them current.
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
        options={(facilitiesQuery.data ?? []).map((facility) => ({ value: facility.id, label: facility.name }))}
        value={facilityId}
        onChange={(event) => setFacilityId(event.target.value)}
        className="mb-4 sm:w-64"
      />
      <LedgerTabs active={tab} onChange={setTab} counts={{ movements: movementTotal, receipts: receiptTotal }}>
        {facilityId && (tab === "movements" ? <MovementsTab facilityId={facilityId} /> : <ReceiptsTab facilityId={facilityId} />)}
      </LedgerTabs>
    </div>
  );
}
