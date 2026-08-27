import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pill } from "lucide-react";
import { dispensePrescription, listDispensingQueue } from "@/shared/api/pharmacy";
import { getFacilities } from "@/shared/api/facilities";
import { ApiError } from "@/shared/api/client";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function label(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/(^| )\w/g, (match) => match.toUpperCase());
}

// PHRM-US-001/009's dispensing queue console — same facility-scoping
// reasoning as QueuePage.tsx (no Station entity exists yet). Dispensing
// itself is gated server-side on a current SAPC registration
// (StaffService.getLicenseStatus()); this page doesn't pre-check that —
// the button is always visible, and a 403 from the API surfaces plainly
// if the signed-in user isn't a pharmacist, same as any other rejected
// request elsewhere in this app.
export function PharmacyQueuePage() {
  const queryClient = useQueryClient();
  const [facilityId, setFacilityId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [dispensingId, setDispensingId] = useState<string | null>(null);

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

  const dispenseMutation = useMutation({
    mutationFn: (id: string) => dispensePrescription(id),
    onMutate: (id) => {
      setActionError(null);
      setDispensingId(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["pharmacy", "queue", facilityId] }),
    onError: (error) => {
      setActionError(error instanceof ApiError ? error.message : "Couldn't dispense that prescription. Try again.");
    },
    onSettled: () => setDispensingId(null),
  });

  const facilities = facilitiesQuery.data ?? [];
  const queue = queueQuery.data ?? [];

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        description="Priority prescriptions first, then earliest issued."
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

      <Card className="overflow-hidden p-0">
        {actionError && (
          <div role="alert" className="border-b border-danger-500/30 bg-danger-50 px-5 py-2.5 text-[13.5px] text-danger-600">
            {actionError}
          </div>
        )}
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
              <div key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13.5px] font-semibold text-text-primary">{p.patientName}</p>
                    <span className="font-mono text-[12px] text-text-secondary">{p.patientMpi}</span>
                    {p.priority === "PRIORITY" && (
                      <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-600">
                        Priority
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 font-mono text-[12px] text-text-secondary">
                    {p.serialNumber} · {p.tokenNumber ? `Token #${p.tokenNumber} · ` : ""}issued {formatTime(p.createdAt)}
                  </p>
                  <p className="mt-1 text-[12.5px] text-text-secondary">
                    Prescribed by <span className="font-medium text-text-primary">{p.prescriberName}</span> · {label(p.visitType)} · {label(p.serviceStream)}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {p.items.map((item, i) => (
                      <li key={i} className="text-[13px] text-text-primary">
                        {item.drugName} — {item.dosage}{" "}
                        <span className="text-text-secondary">× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Button
                  variant="secondary"
                  size="md"
                  icon={<CheckCircle2 className="size-3.5" aria-hidden />}
                  loading={dispensingId === p.id && dispenseMutation.isPending}
                  onClick={() => dispenseMutation.mutate(p.id)}
                  className="shrink-0"
                >
                  Dispense
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
