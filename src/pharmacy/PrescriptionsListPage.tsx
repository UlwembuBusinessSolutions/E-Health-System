// Lihle | 2026-09-09 | Connect the clinic filter to shared clinic selection and expose load errors so prescription browsing follows the active context.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { Input } from "@/shared/components/Input";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";
import { getFacilities } from "@/shared/api/facilities";
import { listPrescriptions } from "@/shared/api/pharmacy";
import { useClinic } from "@/app/ClinicProvider";

interface PrescriptionListFilters {
  facilityId: string;
  status: "ALL" | "PENDING" | "DISPENSED";
  searchTerm: string;
}

export function PrescriptionsListPage() {
  const navigate = useNavigate();
  const { activeClinicId, switchClinic } = useClinic();
  const [filters, setFilters] = useState<PrescriptionListFilters>({
    facilityId: "",
    status: "ALL",
    searchTerm: "",
  });

  const facilitiesQuery = useQuery({
    queryKey: ["facilities"],
    queryFn: getFacilities,
  });

  const prescriptionsQuery = useQuery({
    queryKey: ["pharmacy", "prescriptions"],
    queryFn: listPrescriptions,
  });

  const facilities = facilitiesQuery.data ?? [];
  const prescriptions = prescriptionsQuery.data ?? [];

  const filteredPrescriptions = prescriptions.filter((p) => {
    if (filters.facilityId && p.facilityId !== filters.facilityId) return false;
    if (filters.status !== "ALL" && p.status !== filters.status) return false;
    if (
      filters.searchTerm &&
      !p.patientName.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
      !p.patientMpi.includes(filters.searchTerm) &&
      !p.serialNumber.includes(filters.searchTerm)
    ) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Prescriptions"
          description="Browse and manage prescriptions"
        />
        <Button
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => navigate("/app/pharmacy/create")}
        >
          New Prescription
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-5 mb-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Search"
            placeholder="Search by name, MPI, or serial…"
            icon={<Search className="size-4" aria-hidden />}
            value={filters.searchTerm}
            onChange={(e) =>
              setFilters({ ...filters, searchTerm: e.target.value })
            }
          />
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as PrescriptionListFilters["status"],
                })
              }
              className="w-full px-3 py-2 border border-border-strong rounded-lg text-text-primary bg-white"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="DISPENSED">Dispensed</option>
            </select>
          </div>
          {facilities.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">Facility</label>
              <select
                aria-label="Prescription clinic"
                value={activeClinicId ?? ""}
                onChange={(e) =>
                  void switchClinic(e.target.value)
                }
                className="w-full px-3 py-2 border border-border-strong rounded-lg text-text-primary bg-white"
              >
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* List */}
      <Card className="overflow-hidden p-0">
        {prescriptionsQuery.isError ? <p role="alert" className="p-5 text-danger-600">{prescriptionsQuery.error.message}</p> : prescriptionsQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-text-secondary">Loading prescriptions...</p>
        ) : filteredPrescriptions.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-text-secondary">
            {filters.searchTerm
              ? "No prescriptions match your search"
              : "No prescriptions found"}
          </p>
        ) : (
          <div className="divide-y divide-border-subtle overflow-x-auto">
            {/* Header */}
            <div className="hidden sm:grid grid-cols-6 gap-4 px-5 py-3 bg-surface-raised border-b border-border-subtle text-xs font-semibold uppercase tracking-wide text-text-secondary">
              <div>Serial</div>
              <div>Patient</div>
              <div>MPI</div>
              <div>Status</div>
              <div>Items</div>
              <div>Issued</div>
            </div>

            {/* Rows */}
            {filteredPrescriptions.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/app/pharmacy/prescriptions/${p.id}`)}
                className="block w-full text-left hover:bg-surface-hover p-0 transition-colors"
              >
                <div className="grid sm:grid-cols-6 gap-4 px-5 py-4 items-center">
                  <div>
                    <p className="font-mono text-sm font-semibold text-text-primary">
                      {p.serialNumber}
                    </p>
                    <p className="sm:hidden text-xs text-text-secondary mt-1">
                      {p.patientName}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm text-text-primary">{p.patientName}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="font-mono text-xs text-text-secondary">
                      {p.patientMpi}
                    </p>
                  </div>
                  <div>
                    <StatusPill tone={p.status === "PENDING" ? "warning" : "success"}>
                      {p.status}
                    </StatusPill>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm text-text-secondary">{p.items.length}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-xs text-text-secondary">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Info Card */}
      <Card className="mt-5 p-4 bg-info-50 border border-info-200">
        <p className="text-xs font-semibold uppercase tracking-wide text-info-700 mb-2">
          About the Prescription List
        </p>
        <p className="text-xs text-info-700">
          Search and filter prescriptions by patient name, MPI, or serial number.
          Click any prescription to view details and manage dispensing.
        </p>
      </Card>
    </div>
  );
}
