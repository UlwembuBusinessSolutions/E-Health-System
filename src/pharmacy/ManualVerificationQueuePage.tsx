import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { listManualVerificationCases } from "@/shared/api/pharmacy";
import { Card } from "@/shared/components/Card";
import { PageHeader } from "@/shared/components/PageHeader";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Manual Verification Queue — handles prescriptions where patient identity
 * verification failed during dispensing. These require manual review and
 * verification by pharmacy staff before dispensing can proceed.
 *
 * Backend gating: requires PHRM module access with VIEW permission
 */
export function ManualVerificationQueuePage() {
  const casesQuery = useQuery({
    queryKey: ["pharmacy", "manual-verification"],
    queryFn: listManualVerificationCases,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const cases = casesQuery.data ?? [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <PageHeader
          title="Manual Verification Queue"
          description="Prescriptions requiring manual identity verification"
        />
        <button
          onClick={() => casesQuery.refetch()}
          disabled={casesQuery.isRefetching}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border-strong text-text-secondary hover:bg-surface-hover text-sm font-medium disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${casesQuery.isRefetching ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        {casesQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-text-secondary">
            Loading verification queue…
          </p>
        ) : cases.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <AlertTriangle className="size-6 text-success-600" aria-hidden />
            <p className="text-sm font-medium text-text-primary">
              No pending verifications
            </p>
            <p className="text-xs text-text-secondary">
              All prescriptions have passed identity verification
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {cases.map((c, idx) => (
              <div key={c.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="size-4 text-warning-600 shrink-0" aria-hidden />
                    <p className="text-sm font-semibold text-text-primary">
                      Case #{idx + 1}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono text-xs text-text-secondary">
                      Prescription: {c.prescriptionId}
                    </p>
                    <p className="font-mono text-xs text-text-secondary">
                      Patient ID: {c.patientId}
                    </p>
                    <div className="mt-2 rounded-lg bg-warning-50 p-2 border border-warning-200">
                      <p className="text-xs text-warning-700">
                        <span className="font-semibold">Reason:</span> {c.reason}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0 text-right">
                  <p className="text-xs text-text-secondary">
                    {formatTime(c.createdAt)}
                  </p>
                  <button
                    onClick={() => {
                      // This would navigate to a detailed verification screen
                      // For now, just show the information
                      alert(
                        `Manual verification case:\n\nPrescription: ${c.prescriptionId}\nPatient: ${c.patientId}\nReason: ${c.reason}\n\nReview patient identity and update verification status.`
                      );
                    }}
                    className="px-3 py-2 rounded-lg border border-border-strong text-text-secondary hover:bg-surface-hover text-sm font-medium"
                  >
                    Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Info Card */}
      <Card className="mt-5 p-4 bg-info-50 border border-info-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-info-700 mb-2">
          How Manual Verification Works
        </p>
        <ul className="space-y-1 text-xs text-info-700">
          <li>
            • Prescriptions appear here when patient identity verification fails during dispensing
          </li>
          <li>
            • Verify patient information against available records
          </li>
          <li>
            • Once verified, dispensing can proceed through the normal queue
          </li>
          <li>
            • Only pharmacy staff with appropriate access can handle verifications
          </li>
        </ul>
      </Card>
    </div>
  );
}
