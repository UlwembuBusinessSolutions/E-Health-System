import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { getPrescription } from "@/shared/api/pharmacy";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-text-secondary">No prescription ID provided</p>
      </div>
    );
  }

  const prescriptionQuery = useQuery({
    queryKey: ["prescription", id],
    queryFn: () => getPrescription(id),
  });

  const prescription = prescriptionQuery.data;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong text-text-secondary hover:bg-surface-hover"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <PageHeader
          title={prescription?.serialNumber || "Prescription"}
          description={prescription ? `${prescription.patientName} · ${prescription.patientMpi}` : "Loading…"}
        />
      </div>

      {prescriptionQuery.isLoading ? (
        <Card className="p-10 text-center">
          <p className="text-text-secondary">Loading prescription…</p>
        </Card>
      ) : !prescription ? (
        <Card className="p-10 text-center">
          <p className="text-danger-600">Prescription not found</p>
        </Card>
      ) : (
        <div className="grid gap-5">
          {/* Status and Header Info */}
          <Card className="p-6">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Status
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {prescription.status === "DISPENSED" ? (
                    <>
                      <CheckCircle2 className="size-5 text-success-600" aria-hidden />
                      <StatusPill tone="success">Dispensed</StatusPill>
                    </>
                  ) : (
                    <>
                      <Clock className="size-5 text-warning-600" aria-hidden />
                      <StatusPill tone="warning">Pending</StatusPill>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Issued
                </p>
                <p className="mt-1 text-sm font-medium text-text-primary">
                  {formatDateTime(prescription.createdAt)}
                </p>
              </div>
            </div>

            <div className="border-t border-border-subtle pt-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Patient
                  </p>
                  <p className="mt-2 text-sm text-text-primary">{prescription.patientName}</p>
                  <p className="font-mono text-xs text-text-secondary">{prescription.patientMpi}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Visit
                  </p>
                  <p className="mt-2 font-mono text-xs text-text-primary">{prescription.visitId}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Medications */}
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold text-text-primary">
              Medications
            </h3>
            <div className="space-y-3">
              {prescription.items.length === 0 ? (
                <p className="text-sm text-text-secondary">No medications on this prescription</p>
              ) : (
                prescription.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between rounded-lg border border-border-subtle bg-surface-raised p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-text-primary">{item.drugName}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        Dosage: {item.dosage}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-text-primary">
                        × {item.quantity}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Summary */}
          <Card className="p-6 bg-info-50 border border-info-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-info-700 mb-2">
              About This Prescription
            </p>
            <p className="text-sm text-info-700">
              {prescription.status === "DISPENSED"
                ? "This prescription has been dispensed. A dispensing record has been created."
                : "This prescription is waiting to be dispensed. Only pharmacists with current SAPC registration can dispense it."}
            </p>
          </Card>

          {/* Back Button */}
          <Button variant="secondary" onClick={() => navigate(-1)} className="w-full">
            Back
          </Button>
        </div>
      )}
    </div>
  );
}
