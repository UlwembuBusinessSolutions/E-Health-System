import { useState } from "react";
import PageHeader from "../../../components/common/PageHeader";

export default function Consultations() {
  const [consultation, setConsultation] = useState({
    mpi: "ULW-2026-0001",
    patientName: "Lerato Mokoena",
    clinician: "Dr. Amo Admin",
    complaint: "",
    bloodPressure: "",
    temperature: "",
    pulse: "",
    diagnosis: "",
    notes: "",
    prescription: "",
  });

  const updateField = (field, value) => {
    setConsultation((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();

    const history = JSON.parse(
      localStorage.getItem("ulwembu-consultations") || "[]"
    );

    history.unshift({
      id: Date.now(),
      date: new Date().toISOString(),
      ...consultation,
    });

    localStorage.setItem(
      "ulwembu-consultations",
      JSON.stringify(history)
    );

    alert("Consultation saved successfully.");
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <PageHeader
        title="Clinical Consultations"
        subtitle="Capture vital signs, consultation notes, diagnosis, and prescriptions."
      />

      <form
        onSubmit={handleSave}
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          padding: "24px",
          display: "grid",
          gap: "24px",
        }}
      >
        {/* Patient Details */}
        <section style={{ display: "grid", gap: "16px" }}>
          <h3 style={{ margin: 0 }}>Patient Details</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <label>Master Patient Index (MPI)</label>
              <input
                value={consultation.mpi}
                readOnly
                style={inputStyle}
              />
            </div>

            <div>
              <label>Patient Name</label>
              <input
                value={consultation.patientName}
                readOnly
                style={inputStyle}
              />
            </div>

            <div>
              <label>Clinician</label>
              <input
                value={consultation.clinician}
                onChange={(e) =>
                  updateField("clinician", e.target.value)
                }
                style={inputStyle}
              />
            </div>
          </div>
        </section>

        {/* Presenting Complaint */}
        <section style={{ display: "grid", gap: "12px" }}>
          <h3 style={{ margin: 0 }}>Presenting Complaint</h3>

          <textarea
            rows={3}
            value={consultation.complaint}
            onChange={(e) =>
              updateField("complaint", e.target.value)
            }
            style={textareaStyle}
            placeholder="Enter presenting complaint"
          />
        </section>

        {/* Vital Signs */}
        <section style={{ display: "grid", gap: "16px" }}>
          <h3 style={{ margin: 0 }}>Vital Signs</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <label>Blood Pressure</label>
              <input
                placeholder="120/80"
                value={consultation.bloodPressure}
                onChange={(e) =>
                  updateField("bloodPressure", e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label>Temperature (°C)</label>
              <input
                placeholder="36.5"
                value={consultation.temperature}
                onChange={(e) =>
                  updateField("temperature", e.target.value)
                }
                style={inputStyle}
              />
            </div>

            <div>
              <label>Pulse (bpm)</label>
              <input
                placeholder="72"
                value={consultation.pulse}
                onChange={(e) =>
                  updateField("pulse", e.target.value)
                }
                style={inputStyle}
              />
            </div>
          </div>
        </section>

        {/* Diagnosis */}
        <section style={{ display: "grid", gap: "12px" }}>
          <h3 style={{ margin: 0 }}>Diagnosis</h3>

          <input
            placeholder="Primary diagnosis"
            value={consultation.diagnosis}
            onChange={(e) =>
              updateField("diagnosis", e.target.value)
            }
            style={inputStyle}
          />
        </section>

        {/* Clinical Notes */}
        <section style={{ display: "grid", gap: "12px" }}>
          <h3 style={{ margin: 0 }}>Clinical Notes</h3>

          <textarea
            rows={6}
            value={consultation.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            style={textareaStyle}
            placeholder="Examination findings, assessment, and treatment plan"
          />
        </section>

        {/* Prescription */}
        <section style={{ display: "grid", gap: "12px" }}>
          <h3 style={{ margin: 0 }}>Prescription</h3>

          <textarea
            rows={4}
            value={consultation.prescription}
            onChange={(e) =>
              updateField("prescription", e.target.value)
            }
            style={textareaStyle}
            placeholder="Medication, dosage, frequency, duration"
          />
        </section>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" style={primaryButtonStyle}>
            Save Consultation
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid var(--line)",
  background: "#fff",
  boxSizing: "border-box",
};

const textareaStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid var(--line)",
  background: "#fff",
  resize: "vertical",
  boxSizing: "border-box",
};

const primaryButtonStyle = {
  background: "var(--accent)",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  fontWeight: 600,
  cursor: "pointer",
};
