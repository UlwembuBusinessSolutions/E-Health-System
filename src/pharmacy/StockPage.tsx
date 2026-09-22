import { useEffect, useState, type FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRightLeft,
  ClipboardList,
  PackagePlus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import {
  adjustStock,
  listExpiryWarnings,
  listReorderAlerts,
  listStockLedger,
  receiveStock,
  transferStock,
  writeOffStock,
  type StockBatch,
  type StockMovement,
} from "@/shared/api/pharmacy";

import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA");
}

function movementLabel(type: StockMovement["movementType"]): string {
  switch (type) {
    case "RECEIPT":
      return "Stock received";
    case "DISPENSE":
      return "Dispensed";
    case "WRITE_OFF":
      return "Written off";
    case "ADJUSTMENT":
      return "Stock adjusted";
    case "TRANSFER_OUT":
      return "Transferred out";
    case "TRANSFER_IN":
      return "Transferred in";
    default:
      return type;
  }
}

export function StockPage() {
  const queryClient = useQueryClient();

  const [facilityId, setFacilityId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [receiveForm, setReceiveForm] = useState({
    drugName: "",
    batchNumber: "",
    barcode: "",
    expiryDate: "",
    quantity: "",
    reorderLevel: "",
  });

  const [writeOffBatch, setWriteOffBatch] = useState<StockBatch | null>(null);
  const [adjustBatch, setAdjustBatch] = useState<StockBatch | null>(null);
  const [transferSource, setTransferSource] = useState<StockBatch | null>(
    null,
  );

  const [writeOffQuantity, setWriteOffQuantity] = useState("");
  const [writeOffReason, setWriteOffReason] = useState("");

  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const [transferDestination, setTransferDestination] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: getFacilities,
  });

  const facilities = facilitiesQuery.data ?? [];

  useEffect(() => {
    if (!facilityId && facilities.length > 0) {
      setFacilityId(facilities[0].id);
    }
  }, [facilityId, facilities]);

  const expiryQuery = useQuery({
    queryKey: ["pharmacy", "expiry", facilityId],
    queryFn: () => listExpiryWarnings(facilityId),
    enabled: !!facilityId,
  });

  const reorderQuery = useQuery({
    queryKey: ["pharmacy", "reorder", facilityId],
    queryFn: () => listReorderAlerts(facilityId),
    enabled: !!facilityId,
  });

  const ledgerQuery = useQuery({
    queryKey: ["pharmacy", "ledger", facilityId],
    queryFn: () => listStockLedger(facilityId),
    enabled: !!facilityId,
  });

  const expiryWarnings = expiryQuery.data ?? [];
  const reorderAlerts = reorderQuery.data ?? [];
  const ledger = ledgerQuery.data ?? [];

  const allBatches = Array.from(
    new Map(
      [...expiryWarnings, ...reorderAlerts].map((batch) => [batch.id, batch]),
    ).values(),
  );

  const receiveMutation = useMutation({
    mutationFn: receiveStock,

    onSuccess: () => {
      setReceiveForm({
        drugName: "",
        batchNumber: "",
        barcode: "",
        expiryDate: "",
        quantity: "",
        reorderLevel: "",
      });

      setActionError(null);

      queryClient.invalidateQueries({
        queryKey: ["pharmacy"],
      });
    },

    onError: (error) => {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Couldn't receive stock.",
      );
    },
  });

  const writeOffMutation = useMutation({
    mutationFn: ({
      batchId,
      quantity,
      reason,
    }: {
      batchId: string;
      quantity: number;
      reason: string;
    }) =>
      writeOffStock(batchId, {
        quantity,
        reason,
      }),

    onSuccess: () => {
      setWriteOffBatch(null);
      setWriteOffQuantity("");
      setWriteOffReason("");
      setActionError(null);

      queryClient.invalidateQueries({
        queryKey: ["pharmacy"],
      });
    },

    onError: (error) => {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Couldn't write off stock.",
      );
    },
  });

  const adjustMutation = useMutation({
    mutationFn: ({
      batchId,
      countedQuantity,
      reason,
    }: {
      batchId: string;
      countedQuantity: number;
      reason: string;
    }) =>
      adjustStock(batchId, {
        countedQuantity,
        reason,
      }),

    onSuccess: () => {
      setAdjustBatch(null);
      setAdjustQuantity("");
      setAdjustReason("");
      setActionError(null);

      queryClient.invalidateQueries({
        queryKey: ["pharmacy"],
      });
    },

    onError: (error) => {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Couldn't adjust stock.",
      );
    },
  });

  const transferMutation = useMutation({
    mutationFn: transferStock,

    onSuccess: () => {
      setTransferSource(null);
      setTransferDestination("");
      setTransferQuantity("");
      setTransferReason("");
      setActionError(null);

      queryClient.invalidateQueries({
        queryKey: ["pharmacy"],
      });
    },

    onError: (error) => {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Couldn't transfer stock.",
      );
    },
  });

  const submitReceive = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);

    if (!facilityId) {
      setActionError("Select a facility before receiving stock.");
      return;
    }

    const drugName = receiveForm.drugName.trim();
    const batchNumber = receiveForm.batchNumber.trim();
    const barcode = receiveForm.barcode.trim();
    const quantity = Number(receiveForm.quantity);
    const reorderLevel = Number(receiveForm.reorderLevel);

    if (!drugName) {
      setActionError("Enter a drug name.");
      return;
    }

    if (!batchNumber) {
      setActionError("Enter a batch number.");
      return;
    }

    if (!barcode) {
      setActionError("Enter a barcode.");
      return;
    }

    if (!receiveForm.expiryDate) {
      setActionError("Enter an expiry date.");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setActionError("Quantity must be greater than zero.");
      return;
    }

    if (!Number.isFinite(reorderLevel) || reorderLevel < 0) {
      setActionError("Reorder level must be zero or greater.");
      return;
    }

    receiveMutation.mutate({
      facilityId,
      drugName,
      batchNumber,
      barcode,
      expiryDate: receiveForm.expiryDate,
      quantity,
      reorderLevel,
    });
  };

  const submitWriteOff = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);

    if (!writeOffBatch) {
      return;
    }

    const quantity = Number(writeOffQuantity);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > writeOffBatch.quantityOnHand
    ) {
      setActionError(
        `Write-off quantity must be between 1 and ${writeOffBatch.quantityOnHand}.`,
      );
      return;
    }

    if (!writeOffReason.trim()) {
      setActionError("Enter a reason for the write-off.");
      return;
    }

    writeOffMutation.mutate({
      batchId: writeOffBatch.id,
      quantity,
      reason: writeOffReason.trim(),
    });
  };

  const submitAdjustment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);

    if (!adjustBatch) {
      return;
    }

    const countedQuantity = Number(adjustQuantity);

    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
      setActionError("Counted quantity must be zero or greater.");
      return;
    }

    if (!adjustReason.trim()) {
      setActionError("Enter a reason for the stock adjustment.");
      return;
    }

    adjustMutation.mutate({
      batchId: adjustBatch.id,
      countedQuantity,
      reason: adjustReason.trim(),
    });
  };

  const submitTransfer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);

    if (!transferSource) {
      return;
    }

    const quantity = Number(transferQuantity);

    if (!transferDestination) {
      setActionError("Select a destination batch.");
      return;
    }

    if (transferDestination === transferSource.id) {
      setActionError("The destination must be different from the source.");
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > transferSource.quantityOnHand
    ) {
      setActionError(
        `Transfer quantity must be between 1 and ${transferSource.quantityOnHand}.`,
      );
      return;
    }

    if (!transferReason.trim()) {
      setActionError("Enter a reason for the transfer.");
      return;
    }

    transferMutation.mutate({
      sourceBatchId: transferSource.id,
      destinationBatchId: transferDestination,
      quantity,
      reason: transferReason.trim(),
    });
  };

  return (
    <div>
      <PageHeader
        title="Stock"
        description="Stock receiving, alerts, adjustments, transfers and inventory movements."
        action={
          facilities.length > 1 ? (
            <select
              value={facilityId}
              onChange={(event) => setFacilityId(event.target.value)}
              className="h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {actionError && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-danger-500/30 bg-danger-50 px-5 py-3 text-[13.5px] text-danger-600"
        >
          {actionError}
        </div>
      )}

      {!facilityId ? (
        <Card>
          <p className="py-8 text-center text-[14px] text-text-secondary">
            Loading facilities…
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <p className="text-xs text-text-secondary">Total Alerts</p>
              <p className="mt-2 text-3xl font-bold text-text-primary">
                {allBatches.length}
              </p>
            </Card>

            <Card>
              <p className="text-xs text-text-secondary">
                Expiry Warnings
              </p>
              <p className="mt-2 text-3xl font-bold text-warning-600">
                {expiryWarnings.length}
              </p>
            </Card>

            <Card>
              <p className="text-xs text-text-secondary">
                Reorder Alerts
              </p>
              <p className="mt-2 text-3xl font-bold text-danger-600">
                {reorderAlerts.length}
              </p>
            </Card>

            <Card>
              <p className="text-xs text-text-secondary">
                Stock Movements
              </p>
              <p className="mt-2 text-3xl font-bold text-brand-600">
                {ledger.length}
              </p>
            </Card>
          </div>

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <PackagePlus className="size-5 text-brand-600" />

              <h2 className="text-[15px] font-semibold text-text-primary">
                Receive stock
              </h2>
            </div>

            <form
              onSubmit={submitReceive}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <input
                required
                placeholder="Drug name"
                value={receiveForm.drugName}
                onChange={(event) =>
                  setReceiveForm({
                    ...receiveForm,
                    drugName: event.target.value,
                  })
                }
                className="input"
              />

              <input
                required
                placeholder="Batch number"
                value={receiveForm.batchNumber}
                onChange={(event) =>
                  setReceiveForm({
                    ...receiveForm,
                    batchNumber: event.target.value,
                  })
                }
                className="input"
              />

              <input
                required
                placeholder="Barcode"
                value={receiveForm.barcode}
                onChange={(event) =>
                  setReceiveForm({
                    ...receiveForm,
                    barcode: event.target.value,
                  })
                }
                className="input"
              />

              <input
                required
                type="date"
                value={receiveForm.expiryDate}
                onChange={(event) =>
                  setReceiveForm({
                    ...receiveForm,
                    expiryDate: event.target.value,
                  })
                }
                className="input"
              />

              <input
                required
                min="1"
                type="number"
                placeholder="Quantity"
                value={receiveForm.quantity}
                onChange={(event) =>
                  setReceiveForm({
                    ...receiveForm,
                    quantity: event.target.value,
                  })
                }
                className="input"
              />

              <input
                required
                min="0"
                type="number"
                placeholder="Reorder level"
                value={receiveForm.reorderLevel}
                onChange={(event) =>
                  setReceiveForm({
                    ...receiveForm,
                    reorderLevel: event.target.value,
                  })
                }
                className="input"
              />

              <div className="sm:col-span-2 lg:col-span-3">
                <Button
                  type="submit"
                  loading={receiveMutation.isPending}
                  icon={<PackagePlus className="size-3.5" />}
                >
                  Receive stock
                </Button>
              </div>
            </form>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border-subtle px-5 py-4">
              <h2 className="text-[15px] font-semibold text-text-primary">
                Stock alerts
              </h2>
            </div>

            {allBatches.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-text-secondary">
                No stock alerts.
              </p>
            ) : (
              <div className="divide-y divide-border-subtle">
                {allBatches.map((batch) => (
                  <div
                    key={batch.id}
                    className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-[13.5px] text-text-primary">
                        {batch.drugName}
                      </p>

                      <p className="text-[12px] text-text-secondary">
                        Batch {batch.batchNumber} · Barcode {batch.barcode}
                      </p>

                      <p className="mt-1 text-[12px] text-text-secondary">
                        Expires {formatDate(batch.expiryDate)} ·{" "}
                        {batch.quantityOnHand} units · reorder at{" "}
                        {batch.reorderLevel}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="md"
                        icon={<Trash2 className="size-3.5" />}
                        onClick={() => {
                          setWriteOffBatch(batch);
                          setWriteOffQuantity("");
                          setWriteOffReason("");
                          setActionError(null);
                        }}
                      >
                        Write off
                      </Button>

                      <Button
                        variant="secondary"
                        size="md"
                        icon={<RefreshCw className="size-3.5" />}
                        onClick={() => {
                          setAdjustBatch(batch);
                          setAdjustQuantity(String(batch.quantityOnHand));
                          setAdjustReason("");
                          setActionError(null);
                        }}
                      >
                        Adjust
                      </Button>

                      <Button
                        variant="secondary"
                        size="md"
                        icon={<ArrowRightLeft className="size-3.5" />}
                        onClick={() => {
                          setTransferSource(batch);
                          setTransferDestination("");
                          setTransferQuantity("");
                          setTransferReason("");
                          setActionError(null);
                        }}
                      >
                        Transfer
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="size-5 text-text-primary" />

                <h2 className="text-[15px] font-semibold text-text-primary">
                  Expiry warnings
                </h2>
              </div>

              {expiryWarnings.length === 0 ? (
                <p className="text-[14px] text-text-secondary">
                  No batches approaching expiry.
                </p>
              ) : (
                <div className="space-y-3">
                  {expiryWarnings.map((batch) => (
                    <div
                      key={batch.id}
                      className="rounded-lg border border-border-subtle p-3"
                    >
                      <p className="text-[13.5px] font-semibold text-text-primary">
                        {batch.drugName}
                      </p>

                      <p className="text-[12px] text-text-secondary">
                        Batch {batch.batchNumber}
                      </p>

                      <p className="mt-1 text-[12px] text-text-secondary">
                        Expires {formatDate(batch.expiryDate)} ·{" "}
                        {batch.quantityOnHand} remaining
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="size-5 text-text-primary" />

                <h2 className="text-[15px] font-semibold text-text-primary">
                  Reorder alerts
                </h2>
              </div>

              {reorderAlerts.length === 0 ? (
                <p className="text-[14px] text-text-secondary">
                  No batches require reordering.
                </p>
              ) : (
                <div className="space-y-3">
                  {reorderAlerts.map((batch) => (
                    <div
                      key={batch.id}
                      className="rounded-lg border border-border-subtle p-3"
                    >
                      <p className="text-[13.5px] font-semibold text-text-primary">
                        {batch.drugName}
                      </p>

                      <p className="text-[12px] text-text-secondary">
                        Batch {batch.batchNumber}
                      </p>

                      <p className="mt-1 text-[12px] text-text-secondary">
                        {batch.quantityOnHand} remaining · reorder level{" "}
                        {batch.reorderLevel}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-border-subtle px-5 py-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-5 text-brand-600" />

                <h2 className="text-[15px] font-semibold text-text-primary">
                  Stock movement ledger
                </h2>
              </div>
            </div>

            {ledger.length === 0 ? (
              <p className="px-5 py-10 text-center text-[14px] text-text-secondary">
                No stock movements recorded.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-border-subtle bg-surface-sunken">
                    <tr>
                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Date
                      </th>

                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Drug
                      </th>

                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Movement
                      </th>

                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Quantity
                      </th>

                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Before
                      </th>

                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        After
                      </th>

                      <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                        Reason
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border-subtle">
                    {ledger.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-5 py-3 text-[12px] text-text-secondary">
                          {formatTime(entry.createdAt)}
                        </td>

                        <td className="px-5 py-3 text-[13px] font-medium text-text-primary">
                          {entry.drugName}
                        </td>

                        <td className="px-5 py-3 text-[13px] text-text-primary">
                          {movementLabel(entry.movementType)}
                        </td>

                        <td className="px-5 py-3 text-[13px] text-text-primary">
                          {entry.quantity}
                        </td>

                        <td className="px-5 py-3 text-[13px] text-text-secondary">
                          {entry.quantityBefore}
                        </td>

                        <td className="px-5 py-3 text-[13px] text-text-secondary">
                          {entry.quantityAfter}
                        </td>

                        <td className="px-5 py-3 text-[12px] text-text-secondary">
                          {entry.reason ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {writeOffBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-[16px] font-semibold text-text-primary">
              Write off stock
            </h2>

            <p className="mt-1 text-[13px] text-text-secondary">
              {writeOffBatch.drugName} · {writeOffBatch.batchNumber} ·{" "}
              {writeOffBatch.quantityOnHand} available
            </p>

            <form
              onSubmit={submitWriteOff}
              className="mt-5 space-y-3"
            >
              <input
                required
                min="1"
                max={writeOffBatch.quantityOnHand}
                type="number"
                placeholder="Quantity"
                value={writeOffQuantity}
                onChange={(event) =>
                  setWriteOffQuantity(event.target.value)
                }
                className="input w-full"
              />

              <textarea
                required
                placeholder="Reason"
                value={writeOffReason}
                onChange={(event) =>
                  setWriteOffReason(event.target.value)
                }
                className="input min-h-24 w-full"
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setWriteOffBatch(null);
                    setWriteOffQuantity("");
                    setWriteOffReason("");
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  loading={writeOffMutation.isPending}
                >
                  Write off
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {adjustBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-[16px] font-semibold text-text-primary">
              Adjust stock
            </h2>

            <p className="mt-1 text-[13px] text-text-secondary">
              {adjustBatch.drugName} · {adjustBatch.batchNumber} · current
              quantity {adjustBatch.quantityOnHand}
            </p>

            <form
              onSubmit={submitAdjustment}
              className="mt-5 space-y-3"
            >
              <input
                required
                min="0"
                type="number"
                placeholder="Counted quantity"
                value={adjustQuantity}
                onChange={(event) =>
                  setAdjustQuantity(event.target.value)
                }
                className="input w-full"
              />

              <textarea
                required
                placeholder="Adjustment reason"
                value={adjustReason}
                onChange={(event) =>
                  setAdjustReason(event.target.value)
                }
                className="input min-h-24 w-full"
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setAdjustBatch(null);
                    setAdjustQuantity("");
                    setAdjustReason("");
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  loading={adjustMutation.isPending}
                >
                  Apply adjustment
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {transferSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="w-full max-w-md">
            <h2 className="text-[16px] font-semibold text-text-primary">
              Transfer stock
            </h2>

            <p className="mt-1 text-[13px] text-text-secondary">
              {transferSource.drugName} · {transferSource.batchNumber} ·{" "}
              {transferSource.quantityOnHand} available
            </p>

            <form
              onSubmit={submitTransfer}
              className="mt-5 space-y-3"
            >
              <select
                required
                value={transferDestination}
                onChange={(event) =>
                  setTransferDestination(event.target.value)
                }
                className="input w-full"
              >
                <option value="">Select destination batch</option>

                {allBatches
                  .filter(
                    (batch) =>
                      batch.id !== transferSource.id &&
                      batch.drugName.toLowerCase() ===
                        transferSource.drugName.toLowerCase(),
                  )
                  .map((batch) => (
                    <option key={batch.id} value={batch.id}>
                      {batch.batchNumber} · {batch.quantityOnHand} units
                    </option>
                  ))}
              </select>

              <input
                required
                min="1"
                max={transferSource.quantityOnHand}
                type="number"
                placeholder="Quantity"
                value={transferQuantity}
                onChange={(event) =>
                  setTransferQuantity(event.target.value)
                }
                className="input w-full"
              />

              <textarea
                required
                placeholder="Transfer reason"
                value={transferReason}
                onChange={(event) =>
                  setTransferReason(event.target.value)
                }
                className="input min-h-24 w-full"
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setTransferSource(null);
                    setTransferDestination("");
                    setTransferQuantity("");
                    setTransferReason("");
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  loading={transferMutation.isPending}
                >
                  Transfer stock
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
