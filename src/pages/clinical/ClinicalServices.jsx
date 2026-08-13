import { useState } from "react";

export default function ClinicalServices() {
  const [consultations, setConsultations] = useState([]);

  const [form, setForm] = useState({
    patient: "",
    doctor: "Dr. Nkosi",
    temperature: "",
    bloodPressure: "",
    pulse: "",
    symptoms: "",
    diagnosis: "",
    prescription: "",
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.patient || !form.symptoms || !form.diagnosis) {
      alert("Please complete the required clinical fields.");
      return;
    }

    setConsultations([
      {
        id: Date.now(),
        ...form,
        date: new Date().toLocaleDateString(),
      },
      ...consultations,
    ]);

    setForm({
      patient: "",
      doctor: "Dr. Nkosi",
      temperature: "",
      bloodPressure: "",
      pulse: "",
      symptoms: "",
      diagnosis: "",
      prescription: "",
    });
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, color: "#0f172a" }}>Clinical Services</h1>
        <p style={{ color: "#64748b", marginTop: "6px" }}>
          Record consultations, vitals, diagnoses, and prescriptions for patient visits.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "24px", marginTop: "24px" }}>
          <div>
            <h3 style={sectionTitle}>Patient Consultation</h3>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Patient Name</label>
                <input
                  type="text"
                  name="patient"
                  value={form.patient}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="Enter patient name"
                />
              </div>

              <div>
                <label style={labelStyle}>Attending Doctor</label>
                <select
                  name="doctor"
                  value={form.doctor}
                  onChange={handleChange}
                  style={inputStyle}
                >
                  <option>Dr. Nkosi</option>
                  <option>Dr. Dlamini</option>
                  <option>Dr. Moyo</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <h3 style={sectionTitle}>Vitals</h3>
            <div style={gridStyle}>
              <div>
                <label style={labelStyle}>Temperature (°C)</label>
                <input
                  type="text"
                  name="temperature"
                  value={form.temperature}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="e.g. 36.8"
                />
              </div>

              <div>
                <label style={labelStyle}>Blood Pressure</label>
                <input
                  type="text"
                  name="bloodPressure"
                  value={form.bloodPressure}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="e.g. 120/80"
                />
              </div>

              <div>
                <label style={labelStyle}>Pulse</label>
                <input
                  type="text"
                  name="pulse"
                  value={form.pulse}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="e.g. 72 bpm"
                />
              </div>
            </div>
          </div>

          <div>
            <h3 style={sectionTitle}>Clinical Notes</h3>
            <div style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Symptoms</label>
                <textarea
                  name="symptoms"
                  value={form.symptoms}
                  onChange={handleChange}
                  rows={4}
                  style={textareaStyle}
                  placeholder="Describe the patient's symptoms"
                />
              </div>

              <div>
                <label style={labelStyle}>Diagnosis</label>
                <textarea
                  name="diagnosis"
                  value={form.diagnosis}
                  onChange={handleChange}
                  rows={3}
                  style={textareaStyle}
                  placeholder="Enter diagnosis"
                />
              </div>

              <div>
                <label style={labelStyle}>Prescription / Treatment Plan</label>
                <textarea
                  name="prescription"
                  value={form.prescription}
                  onChange={handleChange}
                  rows={3}
                  style={textareaStyle}
                  placeholder="Enter medication or treatment instructions"
                />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" style={primaryButton}>
              Save Consultation
            </button>
          </div>
        </form>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0 }}>Recent Consultations</h2>
          <span style={{ color: "#64748b", fontSize: "14px" }}>
            {consultations.length} recorded
          </span>
        </div>

        {consultations.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: "#64748b",
              border: "1px dashed #cbd5e1",
              borderRadius: "14px",
            }}
          >
            No consultations have been recorded yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {consultations.map((consultation) => (
              <div
                key={consultation.id}
                style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "16px",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>{consultation.patient}</strong>
                  <span style={{ color: "#64748b", fontSize: "13px" }}>
                    {consultation.date} · {consultation.doctor}
                  </span>
                </div>

                <div style={{ display: "grid", gap: "8px", color: "#334155", fontSize: "14px" }}>
                  <div>
                    <strong>Symptoms:</strong> {consultation.symptoms}
                  </div>
                  <div>
                    <strong>Diagnosis:</strong> {consultation.diagnosis}
                  </div>
                  <div>
                    <strong>Prescription:</strong> {consultation.prescription || "No prescription recorded"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
};

const sectionTitle = {
  margin: "0 0 16px 0",
  color: "#0f172a",
  fontSize: "1.1rem",
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "16px",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const textareaStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
  resize: "vertical",
  fontFamily: "inherit",
};

const primaryButton = {
  background: "#0f766e",
  color: "white",
  border: "none",
  padding: "12px 20px",
  borderRadius: "12px",
  fontWeight: 600,
  cursor: "pointer",
};