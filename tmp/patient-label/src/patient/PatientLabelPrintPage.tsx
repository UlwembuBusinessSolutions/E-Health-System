import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { getPatient } from "@/shared/api/patients";
import { Button } from "@/shared/components/Button";
import { downloadPatientLabel, renderPatientLabel } from "./patientLabel";

export function PatientLabelPrintPage() {
  const { patientId = "" } = useParams();
  const patient = useQuery({ queryKey: ["patients", patientId], queryFn: () => getPatient(patientId), enabled: !!patientId });
  const [label, setLabel] = useState<HTMLCanvasElement>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [paper, setPaper] = useState("a4");
  useEffect(() => {
    setLabel(undefined);
    setError("");
    if (!patient.data) return;
    try { setLabel(renderPatientLabel(patient.data)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not generate label."); }
  }, [patient.data]);
  async function download() {
    if (!label || !patient.data) return;
    setSaving(true);
    setError("");
    try { await downloadPatientLabel(label, patient.data.mpiNumber); }
    catch { setError("Could not download PDF. Please try again."); }
    finally { setSaving(false); }
  }
  return <main className="min-h-screen bg-white p-6 text-black print:p-0">
    <style>{`@media print { @page { size: ${paper === "label" ? "100mm 65mm" : "A4"}; margin: ${paper === "label" ? "0" : "10mm"}; } body { margin: 0; } .patient-label { width: 100mm !important; height: 65mm !important; max-width: none !important; } }`}</style>
    <section className="mb-6 space-y-4 print:hidden">
      <Link to={`/app/patients/${patientId}`} className="underline">Back to patient</Link>
      <h1 className="text-xl font-semibold">Patient label</h1>
      <p>Confirm the identifiers before printing. Print at 100% / actual size with browser headers and footers disabled.</p>
      <p>No label printer? Download the A4 PDF and print it on a standard printer.</p>
      <label className="block">Printer paper <select value={paper} onChange={e => setPaper(e.target.value)} className="ml-2 rounded border p-2">
        <option value="a4">A4 / standard printer</option><option value="label">100 × 65 mm label</option>
      </select></label>
      <div className="flex gap-3">
        <Button disabled={!label} onClick={() => window.print()}>Print label</Button>
        <Button variant="secondary" disabled={!label} loading={saving} onClick={download}>Download PDF (A4)</Button>
      </div>
      {patient.isLoading && <p role="status">Loading patient…</p>}
      {patient.isError && <p role="alert">Could not load this patient. <button className="underline" onClick={() => patient.refetch()}>Retry</button></p>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
    </section>
    {label && <img className="patient-label max-w-full" style={{ width: "100mm", height: "auto" }} src={label.toDataURL("image/png")} alt={`Patient label for ${patient.data?.firstName} ${patient.data?.lastName}, MPI ${patient.data?.mpiNumber}`} />}
  </main>;
}
