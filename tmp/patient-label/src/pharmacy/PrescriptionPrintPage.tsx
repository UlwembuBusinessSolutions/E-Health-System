import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { getPrescription, type PrescriptionStatus } from "@/shared/api/pharmacy";
import { getOrganizationSelf } from "@/shared/api/organization";
import { getFacilities } from "@/shared/api/facilities";
import "./PrescriptionPrintPage.css";

const statusLabels: Record<PrescriptionStatus, string> = {
  PENDING: "Pending dispensing",
  DISPENSED: "Dispensed",
  OUT_OF_STOCK: "Out of stock · Not dispensed",
  PARTIALLY_DISPENSED: "Partially dispensed",
};
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", { day: "2-digit", month: "long", year: "numeric" });
}

export function PrescriptionPrintPage() {
  const { prescriptionId } = useParams<{ prescriptionId: string }>();
  const documentRef = useRef<HTMLElement>(null);
  const printedId = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ["prescription", prescriptionId],
    queryFn: () => getPrescription(prescriptionId as string),
    enabled: !!prescriptionId,
  });
  const organization = useQuery({ queryKey: ["organization-self"], queryFn: getOrganizationSelf, retry: false });
  const facilities = useQuery({ queryKey: ["facilities"], queryFn: getFacilities, retry: false });
  const ready = !!query.data && !organization.isPending && !facilities.isPending;

  // Wait for letterhead assets before printing; refetches must not reopen the dialog.
  useEffect(() => {
    if (!ready || !prescriptionId || printedId.current === prescriptionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const images = Array.from(documentRef.current?.querySelectorAll("img") ?? []);
    void Promise.all([document.fonts.ready, ...images.map((img) => img.decode().catch(() => undefined))]).then(() => {
      if (cancelled) return;
      timer = setTimeout(() => { printedId.current = prescriptionId; window.print(); }, 200);
    });
    return () => { cancelled = true; clearTimeout(timer); };
  }, [ready, prescriptionId]);

  useEffect(() => {
    if (!query.data) return;
    const previous = document.title;
    document.title = `Prescription ${query.data.serialNumber}`;
    return () => { document.title = previous; };
  }, [query.data]);

  if (!prescriptionId) return <p className="rx-message">No prescription specified.</p>;
  if (query.isLoading) return <p className="rx-message" role="status">Loading prescription…</p>;
  if (query.isError || !query.data) return <div className="rx-message" role="alert"><p>Couldn't load this prescription.</p><button className="rx-print-button" onClick={() => void query.refetch()}>Try again</button></div>;

  const p = query.data;
  const org = organization.data;
  const facility = facilities.data?.find((entry) => entry.id === p.facilityId);

  return (
    <main className="rx-preview">
      <div className="rx-toolbar">
        <div className="rx-toolbar-label"><FileText size={19} aria-hidden /><div><strong>Prescription preview</strong><span>A4 document · Print or save as PDF</span></div></div>
        <button type="button" className="rx-print-button" disabled={!ready} onClick={() => window.print()}><Printer size={16} aria-hidden /> Print prescription</button>
      </div>
      <article className="rx-paper" ref={documentRef} aria-label="Prescription">
        <header className="rx-letterhead">
          <div className="rx-practice">
            {org?.logoUrl && <img className="rx-logo" src={org.logoUrl} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
            <div>
              <p className="rx-eyebrow">Medical prescription</p>
              <h1>{org?.displayName ?? facility?.name ?? "Prescription"}</h1>
              {facility && org?.displayName && facility.name !== org.displayName && <p className="rx-facility">{facility.name}</p>}
              {org?.address && <p className="rx-contact">{org.address}</p>}
              {(org?.contactPhone || org?.contactEmail) && <p className="rx-contact">{[org.contactPhone, org.contactEmail].filter(Boolean).join(" · ")}</p>}
            </div>
          </div>
          <div className="rx-reference"><span className="rx-label">Prescription no.</span><strong>{p.serialNumber}</strong><span className="rx-label rx-date-label">Date issued</span><time dateTime={p.createdAt}>{formatDate(p.createdAt)}</time></div>
        </header>
        <section className="rx-details" aria-label="Patient and prescriber details">
          <div><h2 className="rx-label">Patient details</h2><p className="rx-person">{p.patientName}</p><p className="rx-detail-line"><span>Patient MPI</span><span className="rx-mono">{p.patientMpi}</span></p></div>
          <div><h2 className="rx-label">Prescribed by</h2><p className="rx-person">{p.prescriberName ?? "Not recorded"}</p><p className="rx-detail-line"><span>Registration no.</span><span className="rx-mono">{p.prescriberRegistrationNumber ?? "Not recorded"}</span></p></div>
        </section>
        <section className="rx-medications" aria-labelledby="rx-medications-heading">
          <div className="rx-section-heading"><span className="rx-symbol" aria-hidden>℞</span><div><h2 id="rx-medications-heading">Prescribed medication</h2><p>Medication and directions as prescribed</p></div></div>
          <table className="rx-table">
            <thead><tr><th scope="col" className="rx-number">No.</th><th scope="col">Medication / directions</th><th scope="col" className="rx-quantity">Quantity</th></tr></thead>
            <tbody>{p.items.map((item, index) => <tr key={index}><td className="rx-number">{String(index + 1).padStart(2, "0")}</td><td><strong className="rx-drug">{item.drugName}</strong><p className="rx-directions">{item.dosage}</p></td><td className="rx-quantity"><strong>{item.quantity}</strong></td></tr>)}</tbody>
          </table>
          {p.items.length === 0 && <p className="rx-empty">No medication items recorded.</p>}
        </section>
        <section className="rx-signoff" aria-label="Prescriber authorisation">
          <div className="rx-signature"><div className="rx-signature-line" /><p className="rx-label">Prescriber signature</p><p>{p.prescriberName ?? "Name not recorded"}</p></div>
          <div className="rx-stamp"><span>Practice stamp</span></div>
          <div className="rx-signature"><div className="rx-signature-line" /><p className="rx-label">Date signed</p></div>
        </section>
        <section className="rx-dispensing" aria-label="Dispensing record">
          <div className="rx-dispensing-heading"><h2 className="rx-label">Dispensing record</h2><span className={`rx-status rx-status-${p.status.toLowerCase()}`}>{statusLabels[p.status]}</span></div>
          {p.items.map((item, index) => (
            <p key={index}>
              <strong>{item.drugName}:</strong> {statusLabels[item.status]}
              {item.status === "DISPENSED" && ` — ${[item.dispensedByName && `Dispensed by ${item.dispensedByName}`, item.dispensedAt && formatDate(item.dispensedAt)].filter(Boolean).join(" · ")}`}
              {item.status === "OUT_OF_STOCK" && item.outOfStockNote && ` — ${item.outOfStockNote}`}
            </p>
          ))}
        </section>
        <footer className="rx-footer"><span>Confidential medical information</span><span className="rx-mono">{p.serialNumber}</span></footer>
      </article>
    </main>
  );
}
