import { useState } from "react";
import {
  FaStethoscope,
  FaHeartbeat,
  FaUserInjured,
  FaFilePrescription,
  FaFlask,
  FaSave,
  FaCheckCircle,
} from "react-icons/fa";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#334155",
  marginBottom: "6px",
  display: "block",
};

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function ClinicalDashboard() {
  const [consultation, setConsultation] = useState({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    diagnosis: "",
    prescription: "",
    labRequest: "",
    followUp: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setConsultation((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    console.log("Consultation saved", consultation);
    alert("Consultation saved successfully.");
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "999px",
              background: "#ccfbf1",
              color: "#0f766e",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            <FaStethoscope size={12} />
            Clinical Services
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Clinical Consultation Dashboard
          </h1>

          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            Capture SOAP notes, diagnoses, prescriptions, and laboratory
            requests for patient consultations.
          </p>
        </div>

        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            borderRadius: "12px",
            border: "none",
            background: "#0f766e",
            color: "#ffffff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FaCheckCircle size={14} />
          Complete Consultation
        </button>
      </div>

      {/* Patient Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: "20px",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <FaUserInjured size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Current Patient
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Active consultation session
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "16px",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Patient Name</div>
              <div style={{ marginTop: "6px", fontWeight: 700, color: "#0f172a" }}>
                Thandi Mokoena
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Folder Number</div>
              <div style={{ marginTop: "6px", fontWeight: 700, color: "#0f172a" }}>
                UH-2026-00124
              </div>
            </div>

            <div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Consultation Type</div>
              <div style={{ marginTop: "6px", fontWeight: 700, color: "#0f172a" }}>
                Primary Care
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <FaHeartbeat size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Vital Signs
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Latest recorded observations
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Blood Pressure</span>
              <strong style={{ color: "#0f172a" }}>128/84 mmHg</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Heart Rate</span>
              <strong style={{ color: "#0f172a" }}>76 bpm</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Temperature</span>
              <strong style={{ color: "#0f172a" }}>36.7°C</strong>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#64748b" }}>Weight</span>
              <strong style={{ color: "#0f172a" }}>68 kg</strong>
            </div>
          </div>
        </div>
      </div>

      {/* SOAP Notes */}
      <form onSubmit={handleSave} style={{ display: "grid", gap: "24px" }}>
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <FaStethoscope size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                SOAP Consultation Notes
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Structured clinical documentation for the consultation encounter.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "18px" }}>
            <Field label="Subjective (Patient Complaint)">
              <textarea
                name="subjective"
                value={consultation.subjective}
                onChange={handleChange}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Describe the patient's symptoms, duration, and concerns"
              />
            </Field>

            <Field label="Objective (Clinical Findings)">
              <textarea
                name="objective"
                value={consultation.objective}
                onChange={handleChange}
                rows={4}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Physical examination findings, observations, and measurements"
              />
            </Field>

            <Field label="Assessment">
              <textarea
                name="assessment"
                value={consultation.assessment}
                onChange={handleChange}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Clinical assessment and interpretation of findings"
              />
            </Field>

            <Field label="Plan">
              <textarea
                name="plan"
                value={consultation.plan}
                onChange={handleChange}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Treatment plan, advice, follow-up, and referrals"
              />
            </Field>
          </div>
        </div>

        {/* Diagnosis & Orders */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
        >
          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <FaFilePrescription size={18} color="#0f766e" />
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                  Diagnosis & Prescription
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Primary diagnosis and medication orders.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gap: "18px" }}>
              <Field label="Primary Diagnosis">
                <input
                  name="diagnosis"
                  value={consultation.diagnosis}
                  onChange={handleChange}
                  style={inputStyle}
                  placeholder="e.g. Acute upper respiratory tract infection"
                />
              </Field>

              <Field label="Prescription">
                <textarea
                  name="prescription"
                  value={consultation.prescription}
                  onChange={handleChange}
                  rows={5}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Medication, dosage, frequency, and duration"
                />
              </Field>
            </div>
          </div>

          <div style={cardStyle}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "16px",
              }}
            >
              <FaFlask size={18} color="#0f766e" />
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                  Laboratory & Follow-Up
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                  Investigations and follow-up planning.
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gap: "18px" }}>
              <Field label="Laboratory Requests">
                <textarea
                  name="labRequest"
                  value={consultation.labRequest}
                  onChange={handleChange}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="CBC, glucose, urinalysis, imaging, or other investigations"
                />
              </Field>

              <Field label="Follow-Up Instructions">
                <textarea
                  name="followUp"
                  value={consultation.followUp}
                  onChange={handleChange}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical" }}
                  placeholder="Review date, warning signs, referrals, or additional instructions"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Send to Pharmacy
          </button>

          <button
            type="submit"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 20px",
              borderRadius: "12px",
              border: "none",
              background: "#0f766e",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 10px 20px rgba(15, 118, 110, 0.18)",
            }}
          >
            <FaSave size={14} />
            Save Consultation
          </button>
        </div>
      </form>
    </div>
  );
}