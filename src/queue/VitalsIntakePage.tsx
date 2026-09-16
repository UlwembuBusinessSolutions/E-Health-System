import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse, Search } from "lucide-react";
import { listQueue, type TokenStatus } from "@/shared/api/queue";
import { getFacilities } from "@/shared/api/facilities";
import { Card } from "@/shared/components/Card";
import { Button } from "@/shared/components/Button";
import { PageHeader } from "@/shared/components/PageHeader";
import { StatusPill } from "@/shared/components/StatusPill";

const OPEN_STATUSES: TokenStatus[] = ["ISSUED", "CALLED"];

function localDateValue(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

// The "which patient am I taking vitals for" entry point Sidebar's "Take
// Vitals" link lands on — a purpose-built view over the same live queue
// QueuePage manages, not a copy of it: only today's still-open tokens
// (waiting or already called; a completed/missed/cancelled ticket has
// nothing left to triage) and one action per row, so a nurse or doctor
// reaching for this doesn't have to pick their patient out of Boost/
// Complete/Missed/Cancel controls meant for queue-marshal work. Capturing
// vitals before a patient is called is the clinically ordinary order (SATS
// triage informs priority), which is exactly why ISSUED tokens are listed
// here too, not just CALLED ones.
export function VitalsIntakePage() {
  const navigate = useNavigate();
  const [facilityId, setFacilityId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const facilitiesQuery = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });

  useEffect(() => {
    if (!facilityId && facilitiesQuery.data && facilitiesQuery.data.length > 0) {
      setFacilityId(facilitiesQuery.data[0].id);
    }
  }, [facilityId, facilitiesQuery.data]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const queueQuery = useQuery({
    queryKey: ["queue", facilityId, search, OPEN_STATUSES, "", localDateValue(), 0, 100],
    queryFn: () =>
      listQueue(facilityId, {
        search: search || undefined,
        statuses: OPEN_STATUSES,
        date: localDateValue(),
        page: 0,
        pageSize: 100,
      }),
    enabled: !!facilityId,
    refetchInterval: 5000,
  });

  const facilities = facilitiesQuery.data ?? [];
  const entries = queueQuery.data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Take Vitals"
        description="Today's waiting and called patients, ready for vitals or triage capture."
        action={
          facilities.length > 1 ? (
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
          ) : undefined
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-border-subtle p-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" aria-hidden />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, MPI, or token number"
              className="h-10 w-full rounded-lg border border-border-strong bg-surface-raised pl-9 pr-3 text-[13.5px] text-text-primary outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>

        {entries.length === 0 ? (
          <p className="p-8 text-center text-[13.5px] text-text-secondary">
            {queueQuery.isLoading ? "Loading…" : "No one is waiting or called right now."}
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-subtle text-[12px] font-medium uppercase tracking-wide text-text-secondary">
                <th className="px-5 py-3">Token</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Waiting since</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {entries.map((entry) => (
                <tr key={entry.token.id}>
                  <td className="px-5 py-3.5 font-mono text-[13px] text-text-primary tabular-nums">
                    #{entry.token.tokenNumber}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-[13.5px] font-medium text-text-primary">{entry.patientName}</p>
                    <p className="text-[12px] text-text-secondary">{entry.patientMpi}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusPill tone={entry.token.status === "CALLED" ? "success" : "neutral"}>
                      {entry.token.status === "CALLED" ? "Called" : "Waiting"}
                    </StatusPill>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[13px] text-text-secondary tabular-nums">
                    {formatTime(entry.token.issuedAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Button
                      variant="secondary"
                      size="md"
                      icon={<HeartPulse className="size-3.5" aria-hidden />}
                      onClick={() => navigate(`/app/patients/${entry.patientId}?visitId=${entry.token.visitId}`)}
                    >
                      Take vitals
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
