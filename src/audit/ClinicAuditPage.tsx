// Lihle | 2026-09-09 | Add searchable activity records with clinic filters and role-specific API requests so staff can review available audit events.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthContext";
import { useClinic } from "@/app/ClinicProvider";
import { apiClient } from "@/shared/api/client";
import { tenantAuthHeaders } from "@/shared/api/auth";
import { listStaff } from "@/shared/api/staff";
import { PageHeader } from "@/shared/components/PageHeader";
import { Input } from "@/shared/components/Input";
import { Search } from "lucide-react";

interface Event { id: string; userId: string | null; userName?: string; action: string; clinicContextId: string | null; entityType: string; entityId: string; createdAt: string }
export function ClinicAuditPage() {
  const { user } = useAuth();
  const { clinics } = useClinic();
  const [search, setSearch] = useState("");
  const [clinic, setClinic] = useState("");
  const admin = user?.role === "ORG_ADMIN";
  const staff = useQuery({ queryKey: ["staff", "list"], queryFn: listStaff, enabled: admin });
  const events = useQuery({ queryKey: ["audit", "clinic-context", admin], queryFn: async () =>
    (await apiClient.get<{ items: Event[] }>(admin ? "/api/v1/admin/audit" : "/api/v1/audit", { headers: tenantAuthHeaders() })).items });
  const clinicName = (id: string | null) => id ? clinics.find(c => c.id === id)?.name ?? id : "Organization";
  const userName = (event: Event) => {
    const person = staff.data?.find(s => s.id === event.userId);
    return person ? `${person.firstName} ${person.lastName}` : event.userName ?? "System";
  };
  const rows = (events.data ?? []).filter(event => (!clinic || event.clinicContextId === clinic) &&
    `${event.action.replaceAll("_", " ")} ${userName(event)} ${event.entityType} ${clinicName(event.clinicContextId)}`.toLowerCase().includes(search.toLowerCase()));
  return <div>
    <PageHeader title="Audit trail" />
    <div className="mb-5 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1"><Input label="Search activity" icon={<Search className="size-4" />} value={search} onChange={e => setSearch(e.target.value)} /></div>
      <label className="flex w-full flex-col gap-1.5 text-sm font-medium sm:w-60">Clinic
        <select value={clinic} onChange={e => setClinic(e.target.value)} className="h-11 rounded-md border border-border-strong bg-surface-raised px-3">
          <option value="">All clinics</option>{clinics.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}
        </select>
      </label>
    </div>
    {events.isPending ? <p role="status">Loading activity...</p> : events.isError ? <p role="alert" className="text-danger-600">{events.error.message}</p>
      : <div className="overflow-x-auto border-y border-border-subtle"><table className="w-full text-left text-sm">
        <thead><tr className="border-b border-border-subtle text-text-secondary">{["Time", "Action", "User", "Clinic context", "Record"].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{rows.map(event => <tr key={event.id} className="border-b border-border-subtle align-top">
          <td className="whitespace-nowrap px-3 py-4 text-text-secondary">{new Date(event.createdAt).toLocaleString("en-ZA")}</td>
          <td className="px-3 py-4">{event.action.replaceAll("_", " ").toLowerCase()}</td>
          <td className="px-3 py-4">{userName(event)}</td><td className="px-3 py-4">{clinicName(event.clinicContextId)}</td>
          <td className="px-3 py-4"><p>{event.entityType}</p><span className="break-all font-mono text-xs text-text-secondary">{event.entityId}</span></td>
        </tr>)}</tbody>
      </table>{rows.length === 0 && <p className="py-10 text-center text-sm text-text-secondary">No matching activity.</p>}</div>}
  </div>;
}
