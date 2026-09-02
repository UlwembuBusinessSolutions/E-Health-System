import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listVisits } from "@/shared/api/visits";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatCard } from "@/shared/components/StatCard";

// Mock recent assessments - TODO: Replace with API call to listTriageAssessments
const mockRecentAssessments = [
  {
    id: "assess-001",
    visitId: "visit-001",
    patientName: "Sarah Mkhize",
    patientMpi: "MPI-00001",
    systolicBP: 145,
    diastolicBP: 92,
    capturedAt: new Date(Date.now() - 30 * 60000).toISOString(), // 30 mins ago
    status: "abnormal",
  },
  {
    id: "assess-002",
    visitId: "visit-002",
    patientName: "James Ndlela",
    patientMpi: "MPI-00002",
    systolicBP: 120,
    diastolicBP: 80,
    capturedAt: new Date(Date.now() - 90 * 60000).toISOString(), // 90 mins ago
    status: "normal",
  },
  {
    id: "assess-003",
    visitId: "visit-003",
    patientName: "Lindiwe Zuma",
    patientMpi: "MPI-00003",
    systolicBP: 88,
    diastolicBP: 55,
    capturedAt: new Date(Date.now() - 150 * 60000).toISOString(), // 150 mins ago
    status: "abnormal",
  },
];

export function TriageDashboard() {
  const navigate = useNavigate();

  // Fetch visits to show availability of triage capture
  useQuery({
    queryKey: ["visits"],
    queryFn: () => listVisits(),
    refetchInterval: 5000,
  });

  const stats = {
    totalAssessments: mockRecentAssessments.length,
    normalReadings: mockRecentAssessments.filter(
      (a) => a.status === "normal"
    ).length,
    abnormalReadings: mockRecentAssessments.filter(
      (a) => a.status === "abnormal"
    ).length,
    pendingReview: mockRecentAssessments.filter(
      (a) => a.status === "abnormal"
    ).length,
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString("en-ZA");
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Triage Assessment Module"
        description="Vital signs management and patient assessment"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Assessments"
          value={stats.totalAssessments}
          icon={Clock}
          hint="All vital signs captured today"
        />
        <StatCard
          label="Normal Readings"
          value={stats.normalReadings}
          icon={CheckCircle2}
          hint="Vitals within normal ranges"
        />
        <StatCard
          label="Abnormal Readings"
          value={stats.abnormalReadings}
          icon={AlertTriangle}
          hint="Require clinician attention"
        />
        <StatCard
          label="Pending Review"
          value={stats.pendingReview}
          icon={AlertTriangle}
          hint="Out-of-range vitals"
        />
      </div>

      {/* Quick Actions */}
      <Card className="space-y-4 p-6">
        <h3 className="text-sm font-semibold text-text-primary">
          Quick Actions
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            onClick={() => navigate("/app/triage/capture")}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Capture Vitals
          </Button>
          <Button
            onClick={() => navigate("/app/triage/list")}
            variant="secondary"
          >
            Browse Assessments
          </Button>
          <Button
            onClick={() =>
              navigate("/app/triage/list", { state: { filter: "abnormal" } })
            }
            variant="secondary"
          >
            Abnormal Readings
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
          >
            Refresh Data
          </Button>
        </div>
      </Card>

      {/* Abnormal Readings Alert */}
      {stats.abnormalReadings > 0 && (
        <Card className="border-l-4 border-l-yellow-500 bg-yellow-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-900">
                {stats.abnormalReadings} Patient(s) with Abnormal Readings
              </h4>
              <p className="mt-1 text-sm text-yellow-800">
                {stats.abnormalReadings === 1
                  ? "One patient has vital signs outside normal ranges."
                  : `${stats.abnormalReadings} patients have vital signs outside normal ranges.`}{" "}
                Please review and assess for clinical significance.
              </p>
              <Button
                onClick={() =>
                  navigate("/app/triage/list", { state: { filter: "abnormal" } })
                }
                className="mt-3 bg-yellow-600 hover:bg-yellow-700"
              >
                Review Abnormal Readings
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Assessments */}
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Recent Assessments
          </h3>
          <Button
            onClick={() => navigate("/app/triage/list")}
            variant="secondary"
            className="text-xs"
          >
            View All
          </Button>
        </div>

        <div className="space-y-3">
          {mockRecentAssessments.length === 0 ? (
            <div className="flex items-center justify-center rounded-lg border border-dashed border-border-subtle bg-gray-50 py-8">
              <p className="text-sm text-text-secondary">
                No assessments yet. Start by capturing vital signs.
              </p>
            </div>
          ) : (
            mockRecentAssessments.map((assessment) => (
              <button
                key={assessment.id}
                onClick={() =>
                  navigate(`/app/triage/assessments/${assessment.id}`)
                }
                className="flex items-center justify-between rounded-lg border border-border-subtle bg-white p-3 hover:bg-gray-50 active:bg-gray-100"
              >
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-text-primary">
                    {assessment.patientName}
                  </p>
                  <p className="text-xs text-text-secondary">
                    MPI: {assessment.patientMpi} • BP:{" "}
                    {assessment.systolicBP}/{assessment.diastolicBP} mmHg
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formatTime(assessment.capturedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {assessment.status === "abnormal" && (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                  {assessment.status === "normal" && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Available Visits Info Card */}
      <Card className="space-y-3 border-l-4 border-l-blue-500 bg-blue-50 p-4">
        <h4 className="font-semibold text-blue-900">About Triage Assessment</h4>
        <p className="text-sm text-blue-800">
          The Triage module allows clinicians to quickly capture and assess vital
          signs for patients during clinic visits. All measurements are validated
          against clinically plausible ranges and compared with prior assessments
          for trend analysis.
        </p>
        <div className="mt-3 text-xs text-blue-700">
          <p className="font-medium">Requires RECQ License:</p>
          <p>Triage assessment requires appropriate clinical credentials</p>
        </div>
      </Card>
    </div>
  );
}
