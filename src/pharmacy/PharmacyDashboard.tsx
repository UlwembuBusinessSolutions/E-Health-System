import { useQuery } from "@tanstack/react-query";
import { Plus, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getDispensedTodayCount, listDispensingQueue, listManualVerificationCases } from "@/shared/api/pharmacy";
import { getFacilities } from "@/shared/api/facilities";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";

interface QueueStats {
  pending: number;
  dispensed: number;
  verificationCases: number;
}

export function PharmacyDashboard() {
  const navigate = useNavigate();

  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: getFacilities,
  });

  const facilities = facilitiesQuery.data ?? [];
  const primaryFacilityId = facilities.length > 0 ? facilities[0].id : "";

  const queueQuery = useQuery({
    queryKey: ["pharmacy", "queue", primaryFacilityId],
    queryFn: () => (primaryFacilityId ? listDispensingQueue(primaryFacilityId) : Promise.resolve([])),
    enabled: !!primaryFacilityId,
  });

  const verificationQuery = useQuery({
    queryKey: ["pharmacy", "manual-verification"],
    queryFn: listManualVerificationCases,
  });

  const dispensedTodayQuery = useQuery({
    queryKey: ["pharmacy", "dispensed-today", primaryFacilityId],
    queryFn: () => getDispensedTodayCount(primaryFacilityId),
    enabled: !!primaryFacilityId,
  });

  const queue = queueQuery.data ?? [];
  const verificationCases = verificationQuery.data ?? [];

  const stats: QueueStats = {
    pending: queue.length,
    dispensed: dispensedTodayQuery.data ?? 0,
    verificationCases: verificationCases.length,
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <PageHeader
          title="Pharmacy"
          description="Prescription management and dispensing"
        />
        <Button
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => navigate("/app/pharmacy/create")}
        >
          New Prescription
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pending Prescriptions"
          value={stats.pending}
          icon={Clock}
          hint={stats.pending > 0 ? "In queue" : undefined}
        />
        <StatCard
          label="Manual Verifications"
          value={stats.verificationCases}
          icon={AlertTriangle}
          hint={stats.verificationCases > 0 ? "Awaiting review" : undefined}
        />
        <StatCard
          label="Dispensed Today"
          value={stats.dispensed}
          icon={CheckCircle2}
          hint="Completed"
        />
      </div>

      {/* Quick Actions */}
      <Card className="p-6 mb-6">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          Quick Actions
        </h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate("/app/pharmacy/create")}
          >
            Create Prescription
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate("/app/pharmacy/queue")}
          >
            View Dispensing Queue
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate("/app/pharmacy/manual-verification")}
          >
            Manual Verifications
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => navigate("/app/pharmacy/list")}
          >
            Browse Prescriptions
          </Button>
        </div>
      </Card>

      {/* Recent Activity */}
      <Card className="p-6">
        <h3 className="mb-4 text-sm font-semibold text-text-primary">
          Recent Activity
        </h3>

        {queueQuery.isLoading ? (
          <p className="text-sm text-text-secondary">Loading…</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-text-secondary">
            No pending prescriptions in the dispensing queue
          </p>
        ) : (
          <div className="space-y-3">
            {queue.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/app/pharmacy/prescriptions/${p.id}`)}
                className="block w-full text-left p-3 rounded-lg border border-border-subtle hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-text-primary">
                      {p.patientName}
                    </p>
                    <p className="font-mono text-xs text-text-secondary mt-0.5">
                      {p.serialNumber} · {p.patientMpi}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {p.items.length} item{p.items.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 ml-4 text-right">
                    <span className="inline-block px-2 py-1 rounded-full bg-warning-100 text-xs font-medium text-warning-700">
                      Pending
                    </span>
                  </div>
                </div>
              </button>
            ))}
            {queue.length > 5 && (
              <button
                onClick={() => navigate("/app/pharmacy/queue")}
                className="w-full py-2 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                View All ({queue.length} pending)
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Manual Verifications Alert */}
      {verificationCases.length > 0 && (
        <Card className="mt-6 p-4 bg-danger-50 border border-danger-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-danger-600 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold text-sm text-danger-700">
                {verificationCases.length} prescription{verificationCases.length !== 1 ? "s" : ""} awaiting manual verification
              </p>
              <p className="text-xs text-danger-600 mt-1">
                Patient identity verification failed. Review and verify to continue dispensing.
              </p>
              <button
                onClick={() => navigate("/app/pharmacy/manual-verification")}
                className="mt-3 px-3 py-2 rounded-lg bg-danger-600 text-white text-sm font-medium hover:bg-danger-700"
              >
                Review Cases
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Info Card */}
      <Card className="mt-6 p-4 bg-info-50 border border-info-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-info-700 mb-2">
          Pharmacy Module (PHRM)
        </p>
        <p className="text-xs text-info-700">
          This dashboard provides access to prescription creation, dispensing queue management,
          and manual verification workflows. All operations require appropriate license verification
          (HPCSA/SANC for prescribers, SAPC for dispensers).
        </p>
      </Card>
    </div>
  );
}
