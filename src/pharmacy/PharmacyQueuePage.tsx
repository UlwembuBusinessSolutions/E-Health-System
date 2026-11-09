import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Clock3, Search, X, Pill, Grid2X2, ArrowUpRight, Plus } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { getTenantSlug } from "@/shared/api/auth";
import { getFacilities } from "@/shared/api/facilities";
import { dispensePrescriptionItem, getPrescription, getPrescriptionBySerial, listDispensingQueue,
  reviewPrescriptionItem, markPrescriptionItemOutOfStock, sendPrescriberMessage,
  declinePrescriptionItem, declineReasonLabels, type DeclineReason,
  type Prescription, type PrescriptionItem, type ReviewPayload } from "@/shared/api/pharmacy";
import { listStockPositions, listLedger, listProducts, type StockBaseUnit, type StockPosition } from "@/shared/api/pharmacyStock";
import { printPrescription } from "@/shared/lib/printPrescription";
import { useToast } from "@/shared/components/toast/ToastProvider";
import "./PharmacyQueuePage.css";
import { PharmacyConcurrencyCheck } from "./PharmacyConcurrencyCheck";

type Row = { prescription: Prescription; item: PrescriptionItem };
const units: Record<StockBaseUnit, string> = { TABLET: "tablets", CAPSULE: "capsules", BOTTLE: "bottles", VIAL: "vials", SEALED_PACK: "packs", EACH: "units" };
const unit = (base: StockBaseUnit | null) => base ? units[base] : "units";
const remaining = (item: PrescriptionItem) => Math.max(0, item.quantity - item.dispensedQuantity);
const cleared = (item: PrescriptionItem) => item.status !== "DECLINED" && item.clinicalCheckStatus === "PASSED" && !!item.productId;
const message = (error: unknown) => error instanceof Error ? error.message : "Something went wrong. Please try again.";
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
const medicine = (item: PrescriptionItem) => `${item.productName ?? item.drugName}${item.packSize ? ` · ${item.packSize} ${unit(item.baseUnit)}` : ""}`;
const rowStatus = (item: PrescriptionItem) => !cleared(item) ? "Clinical review" : item.status === "PARTIALLY_DISPENSED" ? "Partially dispensed" : item.status === "OUT_OF_STOCK" ? "Out of stock" : "Ready to dispense";

export function PharmacyQueuePage() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const client = useQueryClient();
  const [params] = useSearchParams();
  const storageKey = `pharmacy.facility.${getTenantSlug() ?? ""}`;
  const [facilityChoice, setFacilityChoice] = useState(() => params.get("facilityId") ?? sessionStorage.getItem(storageKey) ?? "");
  const [search, setSearch] = useState("");
  const [onlyReview, setOnlyReview] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);
  const facilities = useQuery({ queryKey: ["facilities", getTenantSlug()], queryFn: getFacilities, refetchInterval: 5000 });
  const facilityId = facilities.data?.find(f => f.id === facilityChoice)?.id ?? facilities.data?.[0]?.id ?? "";
  const queue = useQuery({ queryKey: ["pharmacy", "queue", facilityId], queryFn: () => listDispensingQueue(facilityId), enabled: !!facilityId, refetchInterval: 5000 });
  const positions = useQuery({ queryKey: ["pharmacy", "positions", facilityId], queryFn: () => listStockPositions(facilityId), enabled: !!facilityId, refetchInterval: 5000 });
  const ledger = useQuery({ queryKey: ["pharmacy", "ledger", facilityId], queryFn: () => listLedger({ facilityId, size: 20 }), enabled: !!facilityId, refetchInterval: 5000 });
  const rows: Row[] = (queue.data ?? []).flatMap(prescription => prescription.items.filter(i => remaining(i) > 0 && i.status !== "DECLINED").map(item => ({ prescription, item })));
  const stock = positions.data ?? [];
  const ready = rows.filter(r => cleared(r.item));
  const needsReview = rows.filter(r => !cleared(r.item));
  const stockProducts = new Map<string, { available: number; reorder: number | null }>();
  stock.forEach(s => { const old = stockProducts.get(s.productId); stockProducts.set(s.productId, { available: (old?.available ?? 0) + s.available, reorder: s.reorderThreshold }); });
  const lowStock = [...stockProducts.values()].filter(s => s.reorder !== null && s.available <= s.reorder).length;
  const needle = search.trim().toLowerCase();
  const visibleRows = rows.filter(r => (!onlyReview || !cleared(r.item)) && `${r.prescription.patientName} ${r.prescription.patientMpi} ${r.prescription.serialNumber} ${medicine(r.item)} ${r.prescription.prescriberName}`.toLowerCase().includes(needle));
  const visibleStock = stock.filter(s => `${s.displayName} ${s.code} ${s.lotNumber}`.toLowerCase().includes(needle));
  const error = facilities.error ?? queue.error ?? positions.error ?? ledger.error;
  const loading = facilities.isPending || (!!facilityId && (queue.isPending || positions.isPending));
  function refresh() { void client.invalidateQueries({ queryKey: ["pharmacy"] }); }
  function chooseFacility(value: string) { setFacilityChoice(value); sessionStorage.setItem(storageKey, value); setSelected(null); }

  return <div className="pharmacy-screen">
    <header className="pharmacy-topbar">
      <label className="pharmacy-search"><Search size={18} aria-hidden /><input aria-label="Search pharmacy" placeholder="Search clinics, users or modules" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="pharmacy-topbar-actions">
        <button className="pharmacy-icon-button" aria-label={onlyReview ? "Show all prescriptions" : `Show ${needsReview.length} prescriptions needing review`} aria-pressed={onlyReview} onClick={() => setOnlyReview(v => !v)}><Bell size={17} /></button>
        <a className="pharmacy-icon-button" href="#pharmacy-ledger" aria-label="View recent stock movements"><Clock3 size={17} /></a>
        <div className="pharmacy-user"><span className="pharmacy-avatar">{user?.firstName?.[0]}{user?.lastName?.[0]}</span><span><strong>{user?.firstName} {user?.lastName}</strong><small>{user?.role === "ORG_ADMIN" ? "Tenant Administrator" : user?.role ?? "Staff"}</small></span></div>
        <button className="pharmacy-button secondary" onClick={logout}>Sign out</button>
      </div>
    </header>
    <main className="pharmacy-content">
      <div className="pharmacy-heading"><div><h1>Pharmacy</h1><p>Review prescriptions, dispense medicines and keep stock accurate.</p></div>
        <div className="pharmacy-heading-actions">{!!facilities.data?.length && <label className="pharmacy-clinic-picker">Clinic<select aria-label="Clinic" value={facilityId} onChange={e => chooseFacility(e.target.value)}>{facilities.data?.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
          <button className="pharmacy-button" disabled={!ready.length || loading || !!error} onClick={() => setSelected(ready[0])}><Plus size={14} />Dispense next</button></div>
      </div>
      <nav className="pharmacy-primary-tools" aria-label="Pharmacy inventory"><Link className="pharmacy-button secondary" to="/app/pharmacy/products">Products</Link><Link className="pharmacy-button secondary" to={`/app/pharmacy/products/new${facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ""}`}><Plus size={14} />Add product</Link><Link className="pharmacy-button secondary" to={`/app/pharmacy/stock/receive${facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ""}`}>Receive stock</Link></nav>
      {error && <div className="pharmacy-error" role="alert">{message(error)} <button onClick={() => { void facilities.refetch(); refresh(); }}>Retry</button></div>}
      {!facilities.isPending && !facilities.error && !facilityId && <div className="pharmacy-empty">No clinic has been set up for this organization. <Link to="/app/settings?section=facilities">Add a clinic</Link> to start receiving stock and dispensing prescriptions.</div>}
      <div className="pharmacy-stats" aria-label="Pharmacy summary">
        <Stat icon={<Pill size={17} />} value={loading || error ? "—" : ready.length} label="Ready" detail="Ready to dispense" />
        <Stat icon={<span>!</span>} value={loading || error ? "—" : needsReview.length} label="Needs review" detail="Clinical check" />
        <Stat icon={<Grid2X2 size={17} />} value={loading || error ? "—" : stockProducts.size} label="Stock items" detail="Current inventory" />
        <Stat icon={<ArrowUpRight size={18} />} value={loading || error ? "—" : lowStock} label="Low stock" detail="At or below reorder" />
      </div>
      <section className="pharmacy-panel" aria-labelledby="pharmacy-prescriptions-title">
        <div className="pharmacy-panel-heading"><h2 id="pharmacy-prescriptions-title">Prescriptions</h2><p>Only clinically cleared prescriptions can be dispensed.</p>{onlyReview && <button className="pharmacy-text-button" onClick={() => setOnlyReview(false)}>Showing clinical review · Show all</button>}</div>
        <div className="pharmacy-table-scroll"><table className="pharmacy-prescriptions"><thead><tr><th>Patient</th><th>Medicine</th><th>Prescriber</th><th>Qty</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{visibleRows.map(row => <tr key={row.item.id} data-item-id={row.item.id}><td><strong>{row.prescription.patientName}</strong><small>{row.prescription.patientMpi} · {row.prescription.serialNumber}</small></td><td>{medicine(row.item)}<small>Pack: {row.item.packSize ? `${row.item.packSize} ${unit(row.item.baseUnit)}` : "Awaiting product selection"}</small></td><td>{row.prescription.prescriberName ?? "—"}</td><td>{remaining(row.item)} {unit(row.item.baseUnit)}</td><td><span className="pharmacy-badge">{rowStatus(row.item)}</span></td><td><button className={`pharmacy-button ${cleared(row.item) ? "" : "secondary"}`} onClick={() => setSelected(row)}>{cleared(row.item) ? "Dispense" : "Review"}</button></td></tr>)}
            {!visibleRows.length && <tr><td colSpan={6} className="pharmacy-empty">{loading ? "Loading prescriptions…" : queue.error ? "Prescriptions could not be loaded." : needle ? "No matching prescriptions." : "No prescriptions waiting at this clinic."}</td></tr>}</tbody></table></div>
      </section>
      <div className="pharmacy-stock-grid">
        <section className="pharmacy-panel" aria-labelledby="pharmacy-stock-title"><div className="pharmacy-panel-heading"><h2 id="pharmacy-stock-title">Stock</h2><p>Available quantity by item and batch.</p></div>
          <div className="pharmacy-table-scroll"><table><thead><tr><th>Medicine</th><th>Batch</th><th>Expiry</th><th>Available</th><th>Reorder</th><th>Status</th></tr></thead><tbody>
            {visibleStock.map((s, i) => <tr key={s.accountId ?? `${s.productId}-${i}`}><td><strong>{s.displayName}</strong><small>{s.code}</small></td><td>{s.lotNumber ?? "—"}</td><td className="nowrap">{s.expiryDate ?? "—"}</td><td className="nowrap"><strong>{s.available}</strong> {unit(s.baseUnit)}</td><td>{s.reorderThreshold ?? "—"}</td><td><span className={`pharmacy-badge ${s.status === "In stock" ? "good" : "warning"}`}>{s.status === "Low stock" ? "Reorder" : s.status}</span></td></tr>)}
            {!visibleStock.length && <tr><td colSpan={6} className="pharmacy-empty">{positions.isFetching ? "Loading stock…" : positions.error ? "Stock could not be loaded." : "No stock recorded at this clinic."}</td></tr>}</tbody></table></div>
        </section>
        <section className="pharmacy-panel" id="pharmacy-ledger" aria-labelledby="pharmacy-ledger-title"><div className="pharmacy-panel-heading"><h2 id="pharmacy-ledger-title">Stock ledger</h2><p>Every receipt and dispensing movement changes the running balance.</p></div>
          <div className="pharmacy-table-scroll"><table><thead><tr><th>Time</th><th>Item</th><th>Movement</th><th>Qty</th><th>Balance</th><th>Reference</th></tr></thead><tbody>
            {(ledger.data?.items ?? []).map(e => <tr key={e.id}><td title={new Date(e.createdAt).toLocaleString()}>{time(e.createdAt)}</td><td>{e.productName}</td><td>{e.type === "DISPENSE" ? "Dispensing" : e.type === "RECEIPT" ? "Receipt" : e.type.replaceAll("_", " ").toLowerCase()}</td><td>{e.quantityDelta > 0 ? "+" : ""}{e.quantityDelta}</td><td><strong>{e.balanceAfter}</strong></td><td>{e.sourceReference ?? "—"}</td></tr>)}
            {!ledger.data?.items.length && <tr><td colSpan={6} className="pharmacy-empty">{ledger.isFetching ? "Loading ledger…" : ledger.error ? "Ledger could not be loaded." : "No stock movements recorded."}</td></tr>}</tbody></table></div>
        </section>
      </div>
      {import.meta.env.DEV && <PharmacyConcurrencyCheck />}
      <nav className="pharmacy-module-links" aria-label="Pharmacy tools"><Link to="/app">Dashboard</Link><Link to="/app/pharmacy/stock">Manage stock</Link><Link to="/app/pharmacy/products">Products</Link><Link to="/app/pharmacy/ledger">Full ledger</Link></nav>
      <PrescriptionTools rows={rows} onOpen={setSelected} onRefresh={refresh} facilityId={facilityId} />
    </main>
    {selected && <PrescriptionDialog key={selected.item.id} row={selected} positions={stock} onClose={() => setSelected(null)} onRefresh={refresh} onSuccess={() => { setSelected(null); refresh(); showToast("Dispensing recorded. Stock and prescription quantities updated.", "success"); }} />}
    <div className="pharmacy-search-navigation" hidden={!needle}><Link to="/app/settings">Clinics and settings</Link><Link to="/app/staff">Users</Link><Link to="/app">All modules</Link></div>
  </div>;
}

function Stat({ icon, value, label, detail }: { icon: ReactNode; value: number | string; label: string; detail: string }) {
  return <section className="pharmacy-stat"><div className="pharmacy-stat-icon">{icon}</div><strong>{value}</strong><span>{label}</span><small>{detail}</small></section>;
}
function Info({ label, children }: { label: string; children: ReactNode }) { return <div className="pharmacy-info"><dt>{label}</dt><dd>{children}</dd></div>; }

function PrescriptionDialog({ row, positions, onClose, onSuccess, onRefresh }: { row: Row; positions: StockPosition[]; onClose: () => void; onSuccess: () => void; onRefresh: () => void }) {
  const { showToast } = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [quantity, setQuantity] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");
  const [supplyUntil, setSupplyUntil] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [declineReason, setDeclineReason] = useState<DeclineReason | "">("");
  const [declineNote, setDeclineNote] = useState("");
  const latest = useQuery({ queryKey: ["pharmacy", "prescription", row.prescription.id], queryFn: () => getPrescription(row.prescription.id), refetchInterval: 5000 });
  const prescription = latest.data ?? row.prescription;
  const item = prescription.items.find(i => i.id === row.item.id) ?? row.item;
  const canDispense = cleared(item) && remaining(item) > 0;
  const canDecline = item.status !== "DECLINED" && item.status !== "DISPENSED";
  const warnings = item.duplicateWarnings ?? [];
  const warningIds = warnings.map(w => w.supplyId).join(",");
  useEffect(() => setAcknowledge(false), [warningIds]);
  const declineMutation = useMutation({ mutationFn: async () => {
    if (!declineReason || (declineReason === "OTHER" && !declineNote.trim())) throw new Error("Select a decline reason. Other requires an explanation.");
    await declinePrescriptionItem(prescription.id, item.id, declineReason, declineNote.trim() || undefined);
  }, onSuccess: () => { onRefresh(); onClose(); showToast("Dispensing declined. The decision was recorded and prescriber notification requested.", "success"); },
    onError: e => { setError(message(e)); void latest.refetch(); }, onSettled: () => { busy.current = false; } });
  const options = positions.filter(p => p.productId === item.productId && p.available > 0 && p.batchId && p.locationId);
  const selected = options.find(p => p.accountId === accountId) ?? options[0];
  const stockAvailable = selected?.available ?? 0;
  const amount = Number(quantity);
  const max = Math.min(remaining(item), stockAvailable);
  const valid = quantity.trim() !== "" && Number.isSafeInteger(amount) && amount > 0 && amount <= max;
  useEffect(() => { dialog.current?.showModal(); const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = overflow; }; }, []);
  const mutation = useMutation({ mutationFn: async () => {
    if (!selected?.batchId || !selected.locationId || !valid || !canDispense) throw new Error("Enter a whole quantity within the remaining prescription and available stock.");
    if (!supplyUntil || (warnings.length > 0 && !acknowledge)) throw new Error("Record the supply end date and review any duplicate supply warnings.");
    await dispensePrescriptionItem(prescription.id, item.id, { productId: selected.productId, batchId: selected.batchId, locationId: selected.locationId, quantity: amount, supplyUntil, acknowledgeDuplicateSupply: acknowledge, acknowledgedSupplyIds: acknowledge ? warnings.map(w => w.supplyId) : [] });
  }, onSuccess, onError: e => { setError(message(e)); onRefresh(); void latest.refetch(); }, onSettled: () => { busy.current = false; } });
  function close() { if (!busy.current) onClose(); }
  return <dialog ref={dialog} className="pharmacy-dialog" aria-labelledby="pharmacy-dialog-title" onCancel={e => { e.preventDefault(); close(); }}>
    <div className="pharmacy-dialog-heading"><h2 id="pharmacy-dialog-title">Prescription {prescription.serialNumber}</h2><button className="pharmacy-icon-button" aria-label="Close prescription" disabled={mutation.isPending} onClick={close}><X size={21} /></button></div>
    <form className="pharmacy-dialog-body" onSubmit={e => { e.preventDefault(); if (busy.current) return; if (!valid) { setError(`Enter a whole quantity between 1 and ${max}.`); return; } busy.current = true; setError(""); mutation.mutate(); }}>
      <dl className="pharmacy-info-grid"><Info label="Patient">{prescription.patientName}</Info><Info label="MPI">{prescription.patientMpi}</Info><Info label="Prescriber">{prescription.prescriberName ?? "—"}</Info><Info label="Item">{medicine(item)}</Info><Info label="Pack size">{item.packSize ? `${item.packSize} ${unit(item.baseUnit)}` : "Awaiting product selection"}</Info><Info label="Quantity remaining">{remaining(item)} {unit(item.baseUnit)}</Info><Info label="Clinical checks">{cleared(item) ? "Passed" : item.clinicalCheckNote || "Clinical review required"}</Info><Info label="Stock available">{stockAvailable} {unit(item.baseUnit)}</Info></dl>
      {(error || latest.error) && <div className="pharmacy-error" role="alert">{error || message(latest.error)}</div>}
      {warnings.length > 0 && <section className="pharmacy-error" role="alert" aria-label="Potential duplicate dispensing"><strong>Potential duplicate dispensing</strong><p>This patient has a recorded supply of the same medicine:</p><ul>{warnings.map(w => <li key={w.supplyId}>{w.facilityName} · {new Date(w.dispensedAt).toLocaleString("en-ZA")} · {w.quantity} units · {w.supplyUntil ? `supply through ${w.supplyUntil}` : "supply end date unknown; confirm medication remaining"}</li>)}</ul>{canDispense && <label><input type="checkbox" checked={acknowledge} disabled={mutation.isPending || declineMutation.isPending} onChange={e => setAcknowledge(e.target.checked)} /> I reviewed the prior supply and confirm another supply is appropriate.</label>}</section>}
      {item.status === "DECLINED" && <p className="pharmacy-error" role="status">Dispensing declined: {item.declineReason ? declineReasonLabels[item.declineReason] : ""}. {item.declineNote} {item.dispensedQuantity > 0 && `${item.dispensedQuantity} units previously supplied.`}</p>}
      {canDispense && <div className="pharmacy-quantity-section">
        {options.length > 1 && <label className="pharmacy-field">Batch and location<select value={selected?.accountId ?? ""} disabled={mutation.isPending} onChange={e => setAccountId(e.target.value)}>{options.map(p => <option key={p.accountId} value={p.accountId!}>{p.lotNumber} · {p.locationName} · {p.expiryDate ?? "No expiry"} · {p.available} {unit(p.baseUnit)}</option>)}</select></label>}
        <label className="pharmacy-field" htmlFor="dispense-quantity">Quantity to dispense <span className="required">*</span></label>
        <input id="dispense-quantity" aria-describedby="dispense-quantity-help" type="number" inputMode="numeric" min="1" max={max} step="1" required value={quantity} disabled={mutation.isPending || !stockAvailable} onChange={e => { setQuantity(e.target.value); setError(""); }} />
        <label className="pharmacy-field">Supply end date <span className="required">*</span><input type="date" required value={supplyUntil} disabled={mutation.isPending || declineMutation.isPending} onChange={e => setSupplyUntil(e.target.value)} /></label>
        <p>Record the last date this quantity is expected to cover, based on the prescribed regimen.</p>
        <p id="dispense-quantity-help">{quantity.trim() && !valid && stockAvailable ? `Enter a whole quantity between 1 and ${max}.` : stockAvailable ? "Enter the exact quantity dispensed. A full pack is not required." : "No eligible stock is available at this clinic. Receive stock before dispensing."}</p>
      </div>}
      {canDecline && <fieldset disabled={mutation.isPending || declineMutation.isPending || latest.isPending || !!latest.error}><legend>Decline to dispense</legend><label className="pharmacy-field">Reason code <span className="required">*</span><select value={declineReason} onChange={e => setDeclineReason(e.target.value as DeclineReason | "")}><option value="">Select a reason</option>{Object.entries(declineReasonLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><label className="pharmacy-field">Explanation {declineReason === "OTHER" && "(required)"}<textarea maxLength={500} value={declineNote} onChange={e => setDeclineNote(e.target.value)} /></label><p>The prescriber will be notified and the decision recorded in the audit trail.</p><button type="button" className="pharmacy-button secondary" disabled={!declineReason || (declineReason === "OTHER" && !declineNote.trim())} onClick={() => { if (busy.current) return; busy.current = true; setError(""); declineMutation.mutate(); }}>{declineMutation.isPending ? "Recording decline…" : "Confirm decline"}</button></fieldset>}
      <div className="pharmacy-dialog-footer">{canDispense ? <><button type="button" className="pharmacy-button secondary" onClick={close} disabled={mutation.isPending || declineMutation.isPending}>Cancel</button><button type="submit" className="pharmacy-button" disabled={!valid || !supplyUntil || (warnings.length > 0 && !acknowledge) || mutation.isPending || declineMutation.isPending || latest.isPending || !!latest.error}>{mutation.isPending ? "Dispensing…" : "Confirm dispensing"}</button></> : <button type="button" className="pharmacy-button secondary" onClick={close}>Close</button>}</div>
    </form>
  </dialog>;
}

function PrescriptionTools({ rows, onOpen, onRefresh, facilityId }: { rows: Row[]; onOpen: (row: Row) => void; onRefresh: () => void; facilityId: string }) {
  const [serial, setSerial] = useState("");
  const [lookup, setLookup] = useState<Prescription | null>(null);
  const [itemId, setItemId] = useState("");
  const [productId, setProductId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<ReviewPayload["status"]>("REVIEW_REQUIRED");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const toolsRows = [...rows, ...(lookup && lookup.facilityId === facilityId ? lookup.items.filter(i => !rows.some(r => r.item.id === i.id)).map(item => ({ prescription: lookup, item })) : [])];
  const selected = toolsRows.find(r => r.item.id === itemId);
  const products = useQuery({ queryKey: ["pharmacy", "products", productSearch], queryFn: () => listProducts({ q: productSearch, activeOnly: true, size: 100 }), enabled: open });
  useEffect(() => { setLookup(null); setItemId(""); setNotice(""); setError(""); }, [facilityId]);
  const searchMutation = useMutation({ mutationFn: () => getPrescriptionBySerial(serial.trim().toUpperCase()), onSuccess: p => { if (p.facilityId !== facilityId) { setError("This prescription belongs to another clinic. Select that clinic first."); return; } setLookup(p); setNotice("Prescription found. Select an item below."); }, onError: e => setError(message(e)) });
  const action = useMutation({ mutationFn: async (kind: "review" | "out" | "message") => {
    if (!selected) throw new Error("Select a prescription item.");
    if (kind === "review") await reviewPrescriptionItem(selected.prescription.id, selected.item.id, { productId, status, note });
    if (kind === "out") await markPrescriptionItemOutOfStock(selected.prescription.id, selected.item.id, note);
    if (kind === "message") await sendPrescriberMessage(selected.prescription.id, note);
    return kind;
  }, onSuccess: kind => { setNotice(kind === "review" ? "Clinical review recorded." : kind === "out" ? "Item marked out of stock." : "Message recorded for the prescriber."); onRefresh(); if (lookup) void getPrescription(lookup.id).then(setLookup).catch(e => setError(message(e))); }, onError: e => setError(message(e)) });
  function selectRow(id: string) { setItemId(id); const row = toolsRows.find(r => r.item.id === id); setProductId(row?.item.productId ?? ""); setNote(row?.item.clinicalCheckNote ?? ""); setStatus(row?.item.clinicalCheckStatus ?? "REVIEW_REQUIRED"); setNotice(""); setError(""); }
  return <details className="pharmacy-tools pharmacy-panel" onToggle={e => setOpen(e.currentTarget.open)}><summary>Prescription tools · Clinical review, lookup and prescriber contact</summary><div className="pharmacy-tools-body">
    <form className="pharmacy-tool-search" onSubmit={e => { e.preventDefault(); setError(""); searchMutation.mutate(); }}><label className="pharmacy-field">Prescription serial number<input value={serial} onChange={e => setSerial(e.target.value)} placeholder="e.g. RX-0000005" required /></label><button className="pharmacy-button secondary" disabled={searchMutation.isPending}>Find prescription</button></form>
    <label className="pharmacy-field">Prescription item<select value={itemId} onChange={e => selectRow(e.target.value)}><option value="">Select a prescription item</option>{toolsRows.map(r => <option key={r.item.id} value={r.item.id}>{r.prescription.patientName} · {r.prescription.serialNumber} · {r.item.drugName}</option>)}</select></label>
    {selected && <><p>Prescribed: <strong>{selected.item.drugName}</strong> · {selected.item.dosage} · {selected.item.quantity} units. Confirm the medicine, strength and base unit before recording clearance.</p><div className="pharmacy-tools-grid"><label className="pharmacy-field">Search inventory product<input value={productSearch} onChange={e => setProductSearch(e.target.value)} /></label><label className="pharmacy-field">Product<select required value={productId} disabled={selected.item.dispensedQuantity > 0 && !!selected.item.productId} onChange={e => setProductId(e.target.value)}><option value="">Select the prescribed product</option>{selected.item.productId && !products.data?.items.some(p => p.id === selected.item.productId) && <option value={selected.item.productId}>{selected.item.productName}</option>}{products.data?.items.map(p => <option key={p.id} value={p.id}>{p.displayName} · {p.packSize ?? "—"} {unit(p.baseUnit)}</option>)}</select></label><label className="pharmacy-field">Clinical checks<select value={status} onChange={e => setStatus(e.target.value as ReviewPayload["status"])}><option value="REVIEW_REQUIRED">Review required</option><option value="PASSED">Passed</option></select></label><label className="pharmacy-field">Review note / prescriber message<textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} /></label></div><div className="pharmacy-tools-actions"><button className="pharmacy-button" disabled={!productId || !note.trim() || action.isPending || remaining(selected.item) === 0 || selected.item.status === "DECLINED"} onClick={() => { setError(""); action.mutate("review"); }}>Record clinical review</button><button className="pharmacy-button secondary" onClick={() => onOpen(selected)}>Open prescription</button><button className="pharmacy-button secondary" onClick={() => printPrescription(selected.prescription.id)}>Print</button><button className="pharmacy-button secondary" disabled={action.isPending || remaining(selected.item) === 0 || selected.item.status === "DECLINED"} onClick={() => action.mutate("out")}>Mark out of stock</button><button className="pharmacy-button secondary" disabled={action.isPending || !note.trim()} onClick={() => action.mutate("message")}>Send to prescriber</button>{selected.prescription.prescriberPhone && <a className="pharmacy-button secondary" href={`tel:${selected.prescription.prescriberPhone}`}>Call prescriber</a>}</div></>}
    {(error || products.error) && <p className="pharmacy-error" role="alert">{error || message(products.error)}</p>}{notice && <p className="pharmacy-notice" role="status">{notice}</p>}
  </div></details>;
}
