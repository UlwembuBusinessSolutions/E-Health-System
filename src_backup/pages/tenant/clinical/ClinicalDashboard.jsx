import { useMemo, useState } from "react";
import {
  FaStethoscope,
  FaHeartbeat,
  FaNotesMedical,
  FaCheckCircle,
  FaUserInjured,
} from "react-icons/fa";

const VISIT_STORAGE_KEY = "ulwembu_visits";
const CONSULTATION_STORAGE_KEY = "ulwembu_consultations";

export default function ClinicalDashboard() {
  const [queue, setQueue] = useState(() =>
    JSON.parse(localStorage.getItem(VISIT_STORAGE_KEY) || "[]")
  );

  const waitingPatients = useMemo(
    () => queue.filter((visit) => visit.status === "Waiting"),
    [queue]
  );

  const [selectedVisit, setSelectedVisit] = useState(null);

  const [form, setForm] = useState({
    bloodPressure: "",
    pulse: "",
    temperature: "",
    respiratoryRate: "",
    weight: "",
    height: "",
    symptoms: "",
    diagnosis: "",
    treatmentPlan: "",
    notes: "",
  });

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function completeConsultation() {
    if (!selectedVisit) return;

    const consultations = JSON.parse(
      localStorage.getItem(CONSULTATION_STORAGE_KEY) || "[]"
    );

    const consultation = {
      id: crypto.randomUUID(),
      visitId: selectedVisit.id,
      mpi: selectedVisit.mpi,
      patientName: selectedVisit.patientName,
      queueNumber: selectedVisit.queueNumber,
      ...form,
      consultationDate: new Date().toISOString(),
      clinician: "Dr. Demo User",
    };

    localStorage.setItem(
      CONSULTATION_STORAGE_KEY,
      JSON.stringify([consultation, ...consultations])
    );

    const updatedQueue = queue.map((visit) =>
      visit.id === selectedVisit.id
        ? { ...visit, status: "Completed" }
        : visit
    );

    localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(updatedQueue));

    setQueue(updatedQueue);

    setSelectedVisit(null);

    setForm({
      bloodPressure: "",
      pulse: "",
      temperature: "",
      respiratoryRate: "",
      weight: "",
      height: "",
      symptoms: "",
      diagnosis: "",
      treatmentPlan: "",
      notes: "",
    });

    alert("Consultation completed successfully.");
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div>
        <h1 style={{ marginBottom: "6px" }}>Clinical Consultation</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Assess queued patients, capture vital signs, and record clinical
          consultations.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Queue Sidebar */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "20px",
            padding: "20px",
            boxShadow: "var(--shadow)",
            display: "grid",
            gap: "16px",
            position: "sticky",
            top: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <FaUserInjured size={18} color="var(--accent)" />
            <h2 style={{ margin: 0, fontSize: "18px" }}>Waiting Queue</h2>
          </div>

          {waitingPatients.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--muted)",
                border: "1px dashed var(--line)",
                borderRadius: "16px",
                fontSize: "14px",
              }}
            >
              No patients waiting for consultation.
            </div>
          ) : (
            waitingPatients.map((visit) => (
              <button
                key={visit.id}
                type="button"
                onClick={() => setSelectedVisit(visit)}
                style={{
                  textAlign: "left",
                  padding: "14px",
                  borderRadius: "14px",
                  border:
                    selectedVisit?.id === visit.id
                      ? "1px solid var(--accent)"
                      : "1px solid var(--line)",
                  background:
                    selectedVisit?.id === visit.id
                      ? "rgba(15, 118, 110, 0.08)"
                      : "var(--surface-alt)",
                  cursor: "pointer",
                  display: "grid",
                  gap: "4px",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                  {visit.patientName}
                </div>

                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {visit.queueNumber} · {visit.mpi}
                </div>

                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {visit.priority} · {visit.reason || "No reason recorded"}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Consultation Form */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "var(--shadow)",
            display: "grid",
            gap: "24px",
          }}
        >
          {selectedVisit ? (
            <>
              {/* Patient Banner */}
              <div
                style={{
                  padding: "18px 20px",
                  borderRadius: "18px",
                  background: "linear-gradient(135deg, var(--accent), #0f766e)",
                  color: "white",
                  display: "grid",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  <FaStethoscope size={14} />
                  ACTIVE CONSULTATION
                </div>

                <div style={{ fontSize: "24px", fontWeight: 700 }}>
                  {selectedVisit.patientName}
                </div>

                <div style={{ fontSize: "14px", opacity: 0.9 }}>
                  {selectedVisit.queueNumber} · {selectedVisit.mpi}
                </div>
              </div>

              {/* Vital Signs */}
              <section style={{ display: "grid", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <FaHeartbeat size={18} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "18px" }}>Vital Signs</h2>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <label style={labelStyle}>
                    Blood Pressure
                    <input
                      name="bloodPressure"
                      value={form.bloodPressure}
                      onChange={handleChange}
                      placeholder="120/80"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Pulse
                    <input
                      name="pulse"
                      value={form.pulse}
                      onChange={handleChange}
                      placeholder="72 bpm"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Temperature
                    <input
                      name="temperature"
                      value={form.temperature}
                      onChange={handleChange}
                      placeholder="36.7°C"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Respiratory Rate
                    <input
                      name="respiratoryRate"
                      value={form.respiratoryRate}
                      onChange={handleChange}
                      placeholder="16 rpm"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Weight
                    <input
                      name="weight"
                      value={form.weight}
                      onChange={handleChange}
                      placeholder="70 kg"
                      style={inputStyle}
                    />
                  </label>

                  <label style={labelStyle}>
                    Height
                    <input
                      name="height"
                      value={form.height}
                      onChange={handleChange}
                      placeholder="170 cm"
                      style={inputStyle}
                    />
                  </label>
                </div>
              </section>

              {/* Clinical Notes */}
              <section style={{ display: "grid", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <FaNotesMedical size={18} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "18px" }}>Clinical Notes</h2>
                </div>

                <label style={labelStyle}>
                  Presenting Symptoms
                  <textarea
                    name="symptoms"
                    value={form.symptoms}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Describe the patient's symptoms and presenting complaint..."
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </label>

                <label style={labelStyle}>
                  Diagnosis
                  <textarea
                    name="diagnosis"
                    value={form.diagnosis}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Enter the clinical assessment or diagnosis..."
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </label>

                <label style={labelStyle}>
                  Treatment Plan
                  <textarea
                    name="treatmentPlan"
                    value={form.treatmentPlan}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Record medications, procedures, investigations, or follow-up instructions..."
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </label>

                <label style={labelStyle}>
                  Additional Notes
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={3}
                    placeholder="Any additional clinical observations..."
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </label>
              </section>

              {/* Actions */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                  paddingTop: "8px",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedVisit(null)}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: "1px solid var(--line)",
                    background: "var(--surface-alt)",
                    color: "var(--text)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={completeConsultation}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: "none",
                    background: "var(--accent)",
                    color: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <FaCheckCircle size={14} />
                  Complete Consultation
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: "48px 24px",
                textAlign: "center",
                color: "var(--muted)",
                display: "grid",
                gap: "12px",
              }}
            >
              <FaStethoscope size={40} style={{ justifySelf: "center" }} />
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                Select a patient from the waiting queue
              </div>
              <div style={{ fontSize: "14px" }}>
                Patients added through Reception will appear here for clinical
                assessment.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid var(--line)",
  borderRadius: "10px",
  background: "var(--surface-alt)",
  color: "var(--text)",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text)",
};
