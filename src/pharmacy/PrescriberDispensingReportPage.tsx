import { useState } from "react";
import { PharmacyWorkflowGuide } from "./PharmacyWorkflowGuide";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getFacilities } from "@/shared/api/facilities";
import { getDispensingReport, exportDispensingReport } from "@/shared/api/pharmacyDuty";
import { PageHeader } from "@/shared/components/PageHeader";
import { Button } from "@/shared/components/Button";
import { Card } from "@/shared/components/Card";

const inputStyle = "rounded-lg border border-border-strong bg-surface px-3 py-2 text-text-primary";
export function PrescriberDispensingReportPage() {
  const [selectedClinic, setClinic] = useState("");
  const [from, setFrom] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [page, setPage] = useState(0);
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: getFacilities });
  const facilityId = selectedClinic || facilities.data?.[0]?.id || "";
  const valid = !!from && !!to && from <= to && Date.parse(to) - Date.parse(from) <= 365 * 86400000;
  const report = useQuery({ queryKey: ["pharmacy", "prescriber-report", facilityId, from, to, page],
    queryFn: () => getDispensingReport(facilityId, from, to, page), enabled: !!facilityId && valid });
  const download = useMutation({ mutationFn: () => exportDispensingReport(facilityId, from, to) });
  return <div>
    <PageHeader title="Prescriber-dispensed report" description="Medicines dispensed by licensed prescribers when no dispenser was available." />
    <PharmacyWorkflowGuide title="How to view the prescriber report" steps={[
      { title: "Choose the clinic and dates", description: "Select the clinic, then enter From and To dates. For one day, use the same date in both fields; dates cover full UTC days." },
      { title: "Review recorded dispensing", description: "Completed prescriber dispensing appears automatically. No manual report entry is needed. Check the patient MPI, medicine, dispensing officer and duty evidence." },
      { title: "Export the results", description: "Use Previous and Next to browse, or Export CSV to download all matching rows. If there are more than 10,000 rows, narrow the date range." },
    ]} />
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">Clinic<select aria-label="Report clinic" className={inputStyle} value={facilityId} disabled={download.isPending} onChange={e => {setClinic(e.target.value); setPage(0); download.reset();}}>
          {facilities.data?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select></label>
        <label className="flex flex-col gap-1 text-sm">From (UTC)<input aria-label="From date" className={inputStyle} type="date" value={from} max={to} disabled={download.isPending} onChange={e => {setFrom(e.target.value); setPage(0); download.reset();}} /></label>
        <label className="flex flex-col gap-1 text-sm">To (UTC)<input aria-label="To date" className={inputStyle} type="date" value={to} min={from} disabled={download.isPending} onChange={e => {setTo(e.target.value); setPage(0); download.reset();}} /></label>
        <Button variant="secondary" disabled={!valid || !facilityId || report.isFetching} onClick={() => report.refetch()}>Refresh report</Button>
        <Button disabled={!valid || !report.data?.totalItems || download.isPending || report.isError} onClick={() => download.mutate()}>Export CSV</Button>
      </div>
      <p className="mt-3 text-sm text-text-secondary">Dates include the full UTC day. Up to 366 days per search; CSV exports include all matching rows up to 10,000.</p>
      {!valid && <p role="alert" className="mt-3 text-danger-600">Choose a valid date range of at most 366 days.</p>}
      {download.error && <p role="alert" className="mt-3 text-danger-600">{download.error.message}</p>}
    </Card>
    {(facilities.isError || report.isError) && <p role="alert">Could not load the report. <button onClick={() => {facilities.refetch(); report.refetch();}}>Retry</button></p>}
    {report.isPending && facilityId && valid && <p role="status">Loading report…</p>}
    {!facilityId && !facilities.isPending && !facilities.isError && <p>No clinics are available.</p>}
    {report.data && valid && !report.isError && <Card className="p-5">
      <p className="mb-4 font-semibold">{report.data.totalItems} medicine rows</p>
      {!report.data.items.length ? <p>No prescriber-dispensed medicines match these filters.</p> : <div className="overflow-x-auto">
        <table className="w-full text-left text-sm"><caption className="sr-only">Prescriber-dispensed medicines</caption>
          <thead><tr>{["Date (UTC)","Patient / MPI","Prescription","Medicine / quantity","Dispensed by","Duty evidence"].map(h => <th key={h} className="whitespace-nowrap border-b border-border-subtle p-3">{h}</th>)}</tr></thead>
          <tbody>{report.data.items.map(row => <tr key={row.id} className="border-b border-border-subtle">
            <td className="whitespace-nowrap p-3">{new Date(row.dispensedAt).toISOString().replace("T"," ").slice(0,19)}</td>
            <td className="p-3">{row.patientName}<div className="font-mono text-xs">{row.mpi}</div></td>
            <td className="p-3">{row.serialNumber}</td>
            <td className="p-3">{row.medicine} × {row.quantity}</td>
            <td className="p-3">{row.dispensedBy}<div className="text-xs text-success-600">Prescriber-dispensed</div></td>
            <td className="min-w-48 p-3">{row.dutyReason || "Legacy staff confirmation"}{row.dutyEntryId && <div className="mt-1 break-all font-mono text-xs text-text-secondary">{row.dutyEntryId}</div>}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" disabled={page===0 || report.isFetching} onClick={() => setPage(p => p-1)}>Previous</Button>
        <span className="text-sm">Page {page+1} of {Math.max(1, Math.ceil(report.data.totalItems / 25))}</span>
        <Button variant="secondary" disabled={(page+1)*25 >= report.data.totalItems || report.isFetching} onClick={() => setPage(p => p+1)}>Next</Button>
      </div>
    </Card>}
  </div>;
}

