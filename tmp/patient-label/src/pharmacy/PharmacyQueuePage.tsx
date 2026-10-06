import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Mail, PackageX, Phone, Pill, Printer, Search } from "lucide-react";
import {
  dispenseAllPending,
  dispensePrescriptionItem,
  getPrescriptionBySerial,
  listDispensingQueue,
  markPrescriptionItemOutOfStock,
  sendPrescriberMessage,
  type Prescription,
  type PrescriberMessage,
} from "@/shared/api/pharmacy";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { printPrescription } from "@/shared/lib/printPrescription";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { useToast } from "@/shared/components/toast/ToastProvider";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

interface ItemTarget {
  prescriptionId: string;
  itemId: string;
}

// PHRM-US-001/009's dispensing queue console — same facility-scoping
// reasoning as QueuePage.tsx (no Station entity exists yet). Dispensing
// itself is gated server-side on a current SAPC registration
// (StaffService.getLicenseStatus()); this page doesn't pre-check that —
// the button is always visible, and a 403 from the API surfaces as a toast
// (not a page-top banner — easy to miss on a long queue, confirmed by a
// real "I clicked it and nothing happened" report that was actually this
// exact 403, just an unnoticed banner) if the signed-in user isn't a
// pharmacist, same as any other rejected request elsewhere in this app.
export function PharmacyQueuePage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [facilityId, setFacilityId] = useState("");

  const [outOfStockTarget, setOutOfStockTarget] = useState<ItemTarget | null>(null);
  const [outOfStockNote, setOutOfStockNote] = useState("");

  const [messageTarget, setMessageTarget] = useState<string | null>(null);
  const [messageDraft, setMessageDraft] = useState("");
  const [sentMessages, setSentMessages] = useState<Record<string, PrescriberMessage[]>>({});

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<Prescription | "not_found" | null>(null);

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  const queueQuery = useQuery({
    queryKey: ["pharmacy", "queue", facilityId],
    queryFn: () => listDispensingQueue(facilityId),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });

  function invalidateQueue() {
    queryClient.invalidateQueries({ queryKey: ["pharmacy", "queue", facilityId] });
  }

  // If the prescription being acted on is the one currently shown in the
  // lookup panel (it dropped off the queue, so it isn't in `queue` at all),
  // refresh that panel too — otherwise dispensing the last remaining item
  // there would leave a stale "still pending" row on screen.
  function refreshLookupIfShown(prescriptionId: string) {
    if (lookupResult && lookupResult !== "not_found" && lookupResult.id === prescriptionId) {
      getPrescriptionBySerial(lookupResult.serialNumber).then(setLookupResult).catch(() => {});
    }
  }

  const dispenseAllMutation = useMutation({
    mutationFn: (prescriptionId: string) => dispenseAllPending(prescriptionId),
    onSuccess: (_data, prescriptionId) => {
      invalidateQueue();
      refreshLookupIfShown(prescriptionId);
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't dispense that prescription. Try again.", "error");
    },
  });

  const dispenseItemMutation = useMutation({
    mutationFn: ({ prescriptionId, itemId }: ItemTarget) => dispensePrescriptionItem(prescriptionId, itemId),
    onSuccess: (_data, { prescriptionId }) => {
      invalidateQueue();
      refreshLookupIfShown(prescriptionId);
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't dispense that item. Try again.", "error");
    },
  });

  // Never removes the item — just records that the pharmacy couldn't fill
  // it (PrescriptionService.markItemOutOfStock()'s own why-note). Safe to
  // call again on the same item to update the note.
  const outOfStockMutation = useMutation({
    mutationFn: ({ prescriptionId, itemId, note }: ItemTarget & { note: string }) =>
      markPrescriptionItemOutOfStock(prescriptionId, itemId, note || undefined),
    onSuccess: (_data, { prescriptionId }) => {
      setOutOfStockTarget(null);
      setOutOfStockNote("");
      invalidateQueue();
      refreshLookupIfShown(prescriptionId);
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't mark that item out of stock. Try again.", "error");
    },
  });

  // For a prescription that's entirely dropped off the queue below — every
  // item was out of stock and nothing was left pending. Still visible in
  // the queue? Dispensing directly from there is faster than a lookup.
  const lookupMutation = useMutation({
    mutationFn: (serial: string) => getPrescriptionBySerial(serial),
    onSuccess: (data) => setLookupResult(data),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        setLookupResult("not_found");
      } else {
        showToast(error instanceof ApiError ? error.message : "Couldn't look up that prescription. Try again.", "error");
      }
    },
  });

  // "Something else" — a query for the prescriber that isn't a stock or
  // dispensing action. Sends a real email; the returned thread entry is
  // shown immediately so the sender can see it was recorded.
  const messageMutation = useMutation({
    mutationFn: ({ prescriptionId, message }: { prescriptionId: string; message: string }) =>
      sendPrescriberMessage(prescriptionId, message),
    onSuccess: (saved, { prescriptionId }) => {
      setSentMessages((m) => ({ ...m, [prescriptionId]: [...(m[prescriptionId] ?? []), saved] }));
      setMessageTarget(null);
      setMessageDraft("");
    },
    onError: (error) => {
      showToast(error instanceof ApiError ? error.message : "Couldn't send that message. Try again.", "error");
    },
  });

  const facilities = facilitiesQuery.data ?? [];
  const queue = queueQuery.data ?? [];
  const lookupFound = lookupResult && lookupResult !== "not_found" ? lookupResult : null;

  const cardProps = {
    outOfStockTarget,
    outOfStockNote,
    setOutOfStockNote,
    onOpenOutOfStock: (target: ItemTarget) => {
      setOutOfStockNote("");
      setOutOfStockTarget(target);
    },
    onCancelOutOfStock: () => {
      setOutOfStockTarget(null);
      setOutOfStockNote("");
    },
    onConfirmOutOfStock: () =>
      outOfStockTarget && outOfStockMutation.mutate({ ...outOfStockTarget, note: outOfStockNote }),
    outOfStockPending: outOfStockMutation.isPending,
    onDispenseItem: (target: ItemTarget) => dispenseItemMutation.mutate(target),
    dispenseItemPending: dispenseItemMutation.isPending,
    dispenseItemVariables: dispenseItemMutation.variables,
    onDispenseAll: (prescriptionId: string) => dispenseAllMutation.mutate(prescriptionId),
    dispenseAllPending: dispenseAllMutation.isPending,
    dispenseAllVariables: dispenseAllMutation.variables,
    messageTarget,
    messageDraft,
    setMessageDraft,
    onOpenMessage: (prescriptionId: string) => {
      setMessageDraft("");
      setMessageTarget(prescriptionId);
    },
    onCancelMessage: () => {
      setMessageTarget(null);
      setMessageDraft("");
    },
    onConfirmMessage: (prescriptionId: string) =>
      messageDraft.trim() && messageMutation.mutate({ prescriptionId, message: messageDraft.trim() }),
    messagePending: messageMutation.isPending,
    sentMessages,
  };

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        description="Prescriptions waiting to be dispensed, oldest first."
        action={
          facilities.length > 1 && (
            <div className="relative">
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                className="h-11 appearance-none rounded-lg border border-border-strong bg-surface-raised pl-3.5 pr-10 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )
        }
      />

      <Card className="mb-6 p-5">
        <div className="mb-1 flex items-center gap-2">
          <Search className="size-4 text-brand-600" aria-hidden />
          <h2 className="text-[14.5px] font-semibold text-text-primary">Look up a prescription</h2>
        </div>
        <p className="mb-3 text-[12.5px] text-text-secondary">
          For a prescription that's entirely dropped off the queue below — every item was out of stock and nothing
          was left pending. Still visible in the queue? Dispense it directly from there once stock is back.
        </p>
        <div className="flex flex-wrap items-start gap-2.5">
          <div className="min-w-[220px] flex-1">
            <Input
              label="Serial number"
              placeholder="e.g. RX-0000005"
              icon={<Search className="size-4" aria-hidden />}
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
            />
          </div>
          <Button
            size="md"
            className="mt-[26px]"
            loading={lookupMutation.isPending}
            onClick={() => lookupQuery.trim() && lookupMutation.mutate(lookupQuery.trim().toUpperCase())}
          >
            Search
          </Button>
        </div>

        {lookupResult === "not_found" && (
          <p className="mt-3 text-[13px] text-danger-600">No prescription found with that serial number.</p>
        )}
        {lookupFound && (
          <div className="mt-4 border-t border-border-subtle pt-4">
            <PrescriptionCard prescription={lookupFound} {...cardProps} />
          </div>
        )}
      </Card>

      <Card className="overflow-hidden p-0">
        {!facilityId ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading facilities…</p>
        ) : queueQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-[14px] text-text-secondary">Loading queue…</p>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Pill className="size-6 text-text-secondary" aria-hidden />
            <p className="text-[14px] text-text-secondary">Nothing waiting to be dispensed.</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {queue.map((p) => (
              <div key={p.id} className="px-5 py-4">
                <PrescriptionCard prescription={p} {...cardProps} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

interface PrescriptionCardProps {
  prescription: Prescription;
  outOfStockTarget: ItemTarget | null;
  outOfStockNote: string;
  setOutOfStockNote: (v: string) => void;
  onOpenOutOfStock: (target: ItemTarget) => void;
  onCancelOutOfStock: () => void;
  onConfirmOutOfStock: () => void;
  outOfStockPending: boolean;
  onDispenseItem: (target: ItemTarget) => void;
  dispenseItemPending: boolean;
  dispenseItemVariables: ItemTarget | undefined;
  onDispenseAll: (prescriptionId: string) => void;
  dispenseAllPending: boolean;
  dispenseAllVariables: string | undefined;
  messageTarget: string | null;
  messageDraft: string;
  setMessageDraft: (v: string) => void;
  onOpenMessage: (prescriptionId: string) => void;
  onCancelMessage: () => void;
  onConfirmMessage: (prescriptionId: string) => void;
  messagePending: boolean;
  sentMessages: Record<string, PrescriberMessage[]>;
}

// Shared between the main queue list and the "look up a prescription"
// result — the same per-item actions apply whether it's still in the
// active queue or was found by serial number after dropping off it.
function PrescriptionCard({
  prescription: p,
  outOfStockTarget,
  outOfStockNote,
  setOutOfStockNote,
  onOpenOutOfStock,
  onCancelOutOfStock,
  onConfirmOutOfStock,
  outOfStockPending,
  onDispenseItem,
  dispenseItemPending,
  dispenseItemVariables,
  onDispenseAll,
  dispenseAllPending,
  dispenseAllVariables,
  messageTarget,
  messageDraft,
  setMessageDraft,
  onOpenMessage,
  onCancelMessage,
  onConfirmMessage,
  messagePending,
  sentMessages,
}: PrescriptionCardProps) {
  const hasPending = p.items.some((item) => item.status === "PENDING");
  const messages = sentMessages[p.id] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13.5px] font-semibold text-text-primary">{p.patientName}</p>
            <span className="font-mono text-[12px] text-text-secondary">{p.patientMpi}</span>
          </div>
          <p className="mt-0.5 font-mono text-[12px] text-text-secondary">
            {p.serialNumber} · issued {formatTime(p.createdAt)}
          </p>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            Prescribed by {p.prescriberName ?? "Unknown"}
            {p.prescriberRegistrationNumber && (
              <span className="font-mono"> · Reg. {p.prescriberRegistrationNumber}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="md"
            style={{ height: 36 }}
            icon={<Printer className="size-3.5" aria-hidden />}
            onClick={() => printPrescription(p.id)}
          >
            Print
          </Button>
          {p.prescriberPhone && (
            <a
              href={`tel:${p.prescriberPhone}`}
              title={`Call ${p.prescriberName ?? "prescriber"}`}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-3 text-[13px] font-semibold text-text-primary transition-colors duration-150 hover:bg-surface-sunken"
            >
              <Phone className="size-3.5" aria-hidden />
              Call
            </a>
          )}
          <Button
            variant="secondary"
            size="md"
            style={{ height: 36 }}
            icon={<Mail className="size-3.5" aria-hidden />}
            onClick={() => onOpenMessage(p.id)}
          >
            Message prescriber
          </Button>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {p.items.map((item) => {
          const canDispense = item.status !== "DISPENSED";
          const isEditingOutOfStock =
            outOfStockTarget?.prescriptionId === p.id && outOfStockTarget?.itemId === item.id;
          const isDispensingThis =
            dispenseItemPending &&
            dispenseItemVariables?.prescriptionId === p.id &&
            dispenseItemVariables?.itemId === item.id;
          return (
            <li key={item.id} className="rounded-lg border border-border-subtle bg-surface-sunken/40 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] text-text-primary">
                  {item.drugName} — {item.dosage} <span className="text-text-secondary">× {item.quantity}</span>
                </p>
                {isEditingOutOfStock ? (
                  <div className="flex w-full flex-col gap-2 sm:w-72">
                    <Input
                      label="Note (optional)"
                      placeholder="e.g. Restock expected Friday"
                      value={outOfStockNote}
                      onChange={(e) => setOutOfStockNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button variant="secondary" size="md" onClick={onCancelOutOfStock}>
                        Cancel
                      </Button>
                      <Button size="md" loading={outOfStockPending} onClick={onConfirmOutOfStock}>
                        Confirm
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {item.status === "OUT_OF_STOCK" && (
                      <span className="text-[11.5px] text-danger-600">Out of stock</span>
                    )}
                    {item.status === "DISPENSED" && (
                      <span className="text-[11.5px] text-success-600">Dispensed</span>
                    )}
                    {canDispense && (
                      <Button
                        variant="secondary"
                        size="md"
                        style={{ height: 32, padding: "0 10px" }}
                        icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                        loading={isDispensingThis}
                        onClick={() => onDispenseItem({ prescriptionId: p.id, itemId: item.id })}
                      >
                        Dispense
                      </Button>
                    )}
                    {item.status === "PENDING" && (
                      <Button
                        variant="secondary"
                        size="md"
                        style={{ height: 32, padding: "0 10px" }}
                        icon={<PackageX className="size-3.5" aria-hidden />}
                        onClick={() => onOpenOutOfStock({ prescriptionId: p.id, itemId: item.id })}
                      >
                        Out of stock
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
        <Button
          variant="secondary"
          size="md"
          disabled={!hasPending}
          loading={dispenseAllPending && dispenseAllVariables === p.id}
          onClick={() => onDispenseAll(p.id)}
        >
          Mark all as collected
        </Button>
      </div>

      {messageTarget === p.id && (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
          <label className="text-[13px] font-medium text-text-primary" htmlFor={`message-${p.id}`}>
            Message to {p.prescriberName ?? "the prescriber"}
          </label>
          <textarea
            id={`message-${p.id}`}
            placeholder="e.g. Dosage seems high for this patient's weight — please confirm before I dispense."
            value={messageDraft}
            onChange={(e) => setMessageDraft(e.target.value)}
            className="min-h-[72px] w-full rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2.5 text-[13.5px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <div className="flex gap-2">
            <Button size="md" disabled={!messageDraft.trim()} loading={messagePending} onClick={() => onConfirmMessage(p.id)}>
              Send email
            </Button>
            <Button variant="secondary" size="md" onClick={onCancelMessage}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border-subtle pt-3">
          {messages.map((m) => (
            <p key={m.id} className="text-[12px] text-text-secondary">
              <span className="font-semibold text-text-primary">{m.senderName ?? "You"}</span> to{" "}
              {p.prescriberName ?? "prescriber"} · {formatTime(m.sentAt)} — {m.message}
            </p>
          ))}
          {p.prescriberEmail && (
            <p className="flex items-center gap-1.5 text-[11.5px] text-success-600">
              <CheckCircle2 className="size-3" aria-hidden />
              Email sent to {p.prescriberEmail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
