import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CheckCircle2, Pill } from "lucide-react";

import {
  dispensePrescription,
  listDispensingQueue,
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

export function PharmacyQueuePage() {
  const queryClient = useQueryClient();

  const [facilityId, setFacilityId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [dispensingId, setDispensingId] = useState<string | null>(null);

  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: getFacilities,
  });

  useEffect(() => {
    if (
      !facilityId &&
      facilitiesQuery.data &&
      facilitiesQuery.data.length > 0
    ) {
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

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["pharmacy", "queue", facilityId],
      });

      queryClient.invalidateQueries({
        queryKey: ["pharmacy", "stock"],
      });
    },

    onError: (error) => {
      setActionError(
        error instanceof ApiError
          ? error.message
          : "Couldn't dispense that prescription.",
      );
    },

    onSettled: () => {
      setDispensingId(null);
    },
  });

  const facilities = facilitiesQuery.data ?? [];
  const queue = queueQuery.data ?? [];

  const handleDispense = (id: string) => {
    dispenseMutation.mutate(id);
  };

  const handleFacilityChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setFacilityId(event.target.value);
  };

  return (
    <div>
      <PageHeader
        title="Pharmacy"
        description="Review and dispense prescriptions waiting in the pharmacy queue."
        action={
          facilities.length > 1 && (
            <select
              value={facilityId}
              onChange={handleFacilityChange}
              className="h-11 rounded-lg border border-border-strong bg-surface-raised px-3.5 text-[14px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            >
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          )
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
        <Card className="overflow-hidden p-0">
          {queueQuery.isLoading ? (
            <p className="px-5 py-10 text-center text-[14px] text-text-secondary">
              Loading queue…
            </p>
          ) : queueQuery.isError ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[14px] font-medium text-danger-600">
                Unable to load the dispensing queue.
              </p>

              <p className="mt-1 text-[13px] text-text-secondary">
                Please try again.
              </p>
            </div>
          ) : queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
              <Pill className="size-6 text-text-secondary" />

              <p className="text-[14px] text-text-secondary">
                Nothing waiting to be dispensed.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {queue.map((prescription) => (
                <div
                  key={prescription.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-semibold text-text-primary">
                        {prescription.patientName}
                      </p>

                      <span className="font-mono text-[12px] text-text-secondary">
                        {prescription.patientMpi}
                      </span>
                    </div>

                    <p className="mt-0.5 font-mono text-[12px] text-text-secondary">
                      {prescription.serialNumber} · issued{" "}
                      {formatTime(prescription.createdAt)}
                    </p>

                    <ul className="mt-2 flex flex-col gap-1">
                      {prescription.items.map((item, index) => (
                        <li
                          key={index}
                          className="text-[13px] text-text-primary"
                        >
                          {item.drugName} — {item.dosage}{" "}
                          <span className="text-text-secondary">
                            × {item.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <Button
                    variant="secondary"
                    size="md"
                    icon={
                      <CheckCircle2
                        className="size-3.5"
                        aria-hidden
                      />
                    }
                    loading={
                      dispensingId === prescription.id &&
                      dispenseMutation.isPending
                    }
                    onClick={() => handleDispense(prescription.id)}
                    className="shrink-0"
                  >
                    Dispense
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
