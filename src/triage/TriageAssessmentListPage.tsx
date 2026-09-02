import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { Select } from "@/shared/components/Select";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";

// Mock assessment data
const mockAssessments = [
  {
    id: "assess-001",
    patientName: "Sarah Mkhize",
    patientMpi: "MPI-00001",
    visitId: "visit-001",
    systolicBP: 145,
    diastolicBP: 92,
    heartRate: 88,
    temperature: "37.5",
    status: "abnormal",
    capturedAt: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: "assess-002",
    patientName: "James Ndlela",
    patientMpi: "MPI-00002",
    visitId: "visit-002",
    systolicBP: 120,
    diastolicBP: 80,
    heartRate: 75,
    temperature: "37.0",
    status: "normal",
    capturedAt: new Date(Date.now() - 90 * 60000).toISOString(),
  },
  {
    id: "assess-003",
    patientName: "Lindiwe Zuma",
    patientMpi: "MPI-00003",
    visitId: "visit-003",
    systolicBP: 88,
    diastolicBP: 55,
    heartRate: 62,
    temperature: "36.5",
    status: "abnormal",
    capturedAt: new Date(Date.now() - 150 * 60000).toISOString(),
  },
  {
    id: "assess-004",
    patientName: "Thabo Sithole",
    patientMpi: "MPI-00004",
    visitId: "visit-004",
    systolicBP: 135,
    diastolicBP: 85,
    heartRate: 82,
    temperature: "37.2",
    status: "normal",
    capturedAt: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
  },
  {
    id: "assess-005",
    patientName: "Prudence Mokoena",
    patientMpi: "MPI-00005",
    visitId: "visit-005",
    systolicBP: 165,
    diastolicBP: 105,
    heartRate: 95,
    temperature: "38.2",
    status: "abnormal",
    capturedAt: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
  },
];

interface TriageAssessmentFilters {
  searchTerm: string;
  status: "ALL" | "NORMAL" | "ABNORMAL";
  facilityId: string;
}

export function TriageAssessmentListPage() {
  const navigate = useNavigate();

  // Mock facilities data
  const mockFacilities = [
    { id: "fac-001", name: "City Clinic" },
    { id: "fac-002", name: "Rural Health Center" },
    { id: "fac-003", name: "District Hospital" },
  ];

  // Filter state
  const [filters, setFilters] = useState<TriageAssessmentFilters>({
    searchTerm: "",
    status: "ALL",
    facilityId: "",
  });

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    return mockAssessments.filter((assessment) => {
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        if (
          !assessment.patientName.toLowerCase().includes(searchLower) &&
          !assessment.patientMpi.toLowerCase().includes(searchLower)
        ) {
          return false;
        }
      }

      // Status filter
      if (filters.status === "NORMAL" && assessment.status !== "normal") {
        return false;
      }
      if (filters.status === "ABNORMAL" && assessment.status !== "abnormal") {
        return false;
      }

      return true;
    });
  }, [filters]);

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Triage Assessments"
        description="Browse and manage vital signs assessments"
      />

      {/* Search & Filter Card */}
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Search & Filter
          </h3>
          <Button
            onClick={() => navigate("/app/triage/capture")}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Assessment
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {/* Search Input */}
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
            <Input
              label="Search assessments"
              type="text"
              placeholder="Search by name, MPI, or serial…"
              value={filters.searchTerm}
              onChange={(e) =>
                setFilters({ ...filters, searchTerm: e.target.value })
              }
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <Select
            label="Status"
            value={filters.status}
            onChange={(e) =>
              setFilters({
                ...filters,
                status: (e.target as HTMLSelectElement).value as "ALL" | "NORMAL" | "ABNORMAL",
              })
            }
            options={[
              { label: "All Statuses", value: "ALL" },
              { label: "Normal Readings", value: "NORMAL" },
              { label: "Abnormal Readings", value: "ABNORMAL" },
            ]}
          />

          {/* Facility Filter - Only show if multiple facilities */}
          {mockFacilities.length > 1 && (
            <Select
              label="Facility"
              value={filters.facilityId}
              onChange={(e) =>
                setFilters({ ...filters, facilityId: (e.target as HTMLSelectElement).value })
              }
              options={[
                { label: "All Facilities", value: "" },
                ...mockFacilities.map((f: any) => ({
                  label: f.name,
                  value: f.id,
                })),
              ]}
            />
          )}
        </div>

        <p className="text-xs text-text-secondary">
          {filteredAssessments.length} of {mockAssessments.length} assessments
        </p>
      </Card>

      {/* Assessments Table */}
      <Card className="overflow-hidden">
        {filteredAssessments.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12">
            <p className="text-sm text-text-secondary">
              {filters.searchTerm
                ? "No assessments match your search criteria"
                : "No assessments yet"}
            </p>
            {!filters.searchTerm && (
              <Button
                onClick={() => navigate("/app/triage/capture")}
                className="mt-4 bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Capture Vitals
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-gray-50">
                  <th className="px-4 py-3 text-left font-semibold text-text-primary">
                    Patient
                  </th>
                  <th className="hidden px-4 py-3 text-left font-semibold text-text-primary sm:table-cell">
                    MPI
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary">
                    Blood Pressure
                  </th>
                  <th className="hidden px-4 py-3 text-left font-semibold text-text-primary md:table-cell">
                    HR / Temp
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary">
                    Status
                  </th>
                  <th className="hidden px-4 py-3 text-left font-semibold text-text-primary lg:table-cell">
                    Captured
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-text-primary">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAssessments.map((assessment, idx) => (
                  <tr
                    key={assessment.id}
                    className={
                      idx % 2 === 0
                        ? "border-b border-border-subtle bg-white"
                        : "border-b border-border-subtle bg-gray-50"
                    }
                  >
                    <td className="px-4 py-3 text-text-primary">
                      {assessment.patientName}
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary sm:table-cell">
                      <span className="font-mono text-xs">
                        {assessment.patientMpi}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-primary">
                      <span className="font-mono">
                        {assessment.systolicBP}/{assessment.diastolicBP}
                      </span>
                      <br />
                      <span className="text-xs text-text-secondary">mmHg</span>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary md:table-cell">
                      <span className="text-xs">
                        {assessment.heartRate} bpm / {assessment.temperature}°C
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        tone={assessment.status === "normal" ? "success" : "warning"}
                      >
                        {assessment.status === "normal" ? "Normal" : "Abnormal"}
                      </StatusPill>
                    </td>
                    <td className="hidden px-4 py-3 text-text-secondary lg:table-cell">
                      <span className="text-xs">
                        {formatDateTime(assessment.capturedAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        onClick={() =>
                          navigate(`/app/triage/assessments/${assessment.id}`)
                        }
                        variant="secondary"
                        className="text-xs"
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Info Card */}
      <Card className="space-y-2 border-l-4 border-l-blue-500 bg-blue-50 p-4">
        <h4 className="font-semibold text-blue-900">Assessment History</h4>
        <p className="text-sm text-blue-800">
          This page shows all triage assessments. Abnormal readings are
          highlighted for easy identification. Click on any assessment to view
          detailed vital signs and compare with prior readings.
        </p>
      </Card>
    </div>
  );
}
