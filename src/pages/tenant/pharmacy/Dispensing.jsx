import { useMemo, useState } from "react";
import {
  FaCapsules,
  FaCheckCircle,
  FaClock,
  FaUser,
  FaPills,
} from "react-icons/fa";

const CONSULTATION_STORAGE_KEY = "ulwembu_consultations";
const DISPENSED_STORAGE_KEY = "ulwembu_dispensed";

function extractMedications(treatmentPlan = "") {
  if (!treatmentPlan.trim()) return [];

  return treatmentPlan
    .split(/[\\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function Dispensing() {
  const consultations = useMemo(
    () =>
      JSON.parse(localStorage.getItem(CONSULTATION_STORAGE_KEY) || "[]"),
    []
  );

  const [dispensed, setDispensed] = useState(() =>
    JSON.parse(localStorage.getItem(DISPENSED_STORAGE_KEY) || "[]")
  );

  const pendingPrescriptions = consultations.filter(
    (consultation) =>
      !dispensed.some((record) => record.consultationId === consultation.id)
  );

  const [selectedPrescription, setSelectedPrescription] = useState(null);

  function dispenseMedication() {
    if (!selectedPrescription) return;

    const record = {
      id: crypto.randomUUID(),
      consultationId: selectedPrescription.id,
      mpi: selectedPrescription.mpi,
      patientName: selectedPrescription.patientName,
      medications: extractMedications(selectedPrescription.treatmentPlan),
      dispensedBy: "Pharmacist Demo User",
      dispensedAt: new Date().toISOString(),
      status: "Dispensed",
    };

    const updated = [record, ...dispensed];

    localStorage.setItem(DISPENSED_STORAGE_KEY, JSON.stringify(updated));

    setDispensed(updated);
    setSelectedPrescription(null);

    alert("Medication dispensed successfully.");
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div>
        <h1 style={{ marginBottom: "6px" }}>Prescription Dispensing</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Review prescriptions generated from clinical consultations and record
          medication dispensing.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Prescription Queue */}
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
            <FaPills size={18} color="var(--accent)" />
            <h2 style={{ margin: 0, fontSize: "18px" }}>Pending Prescriptions</h2>
          </div>

          {pendingPrescriptions.length === 0 ? (
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
              No pending prescriptions available.
            </div>
          ) : (
            pendingPrescriptions.map((prescription) => (
              <button
                key={prescription.id}
                type="button"
                onClick={() => setSelectedPrescription(prescription)}
                style={{
                  textAlign: "left",
                  padding: "14px",
                  borderRadius: "14px",
                  border:
                    selectedPrescription?.id === prescription.id
                      ? "1px solid var(--accent)"
                      : "1px solid var(--line)",
                  background:
                    selectedPrescription?.id === prescription.id
                      ? "rgba(15, 118, 110, 0.08)"
                      : "var(--surface-alt)",
                  cursor: "pointer",
                  display: "grid",
                  gap: "6px",
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                  {prescription.patientName}
                </div>

                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {prescription.mpi}
                </div>

                <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {new Date(prescription.consultationDate).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Dispensing Panel */}
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
          {selectedPrescription ? (
            <>
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
                  <FaCapsules size={14} />
                  ACTIVE PRESCRIPTION
                </div>

                <div style={{ fontSize: "24px", fontWeight: 700 }}>
                  {selectedPrescription.patientName}
                </div>

                <div style={{ fontSize: "14px", opacity: 0.9 }}>
                  {selectedPrescription.mpi}
                </div>
              </div>

              <section style={{ display: "grid", gap: "18px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <FaUser size={16} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "18px" }}>Patient Information</h2>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <InfoCard label="Patient" value={selectedPrescription.patientName} />
                  <InfoCard label="MPI" value={selectedPrescription.mpi} />
                  <InfoCard
                    label="Consultation Date"
                    value={new Date(
                      selectedPrescription.consultationDate
                    ).toLocaleString()}
                  />
                  <InfoCard
                    label="Clinician"
                    value={selectedPrescription.clinician}
                  />
                </div>
              </section>

              <section style={{ display: "grid", gap: "16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <FaPills size={16} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "18px" }}>Medication Order</h2>
                </div>

                <div
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "16px",
                    padding: "18px",
                    background: "var(--surface-alt)",
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  {extractMedications(selectedPrescription.treatmentPlan).length === 0 ? (
                    <div style={{ color: "var(--muted)", fontSize: "14px" }}>
                      No medications were identified in the treatment plan.
                    </div>
                  ) : (
                    extractMedications(selectedPrescription.treatmentPlan).map(
                      (medication, index) => (
                        <div
                          key={index}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 12px",
                            borderRadius: "12px",
                            background: "var(--card)",
                            border: "1px solid var(--line)",
                          }}
                        >
                          <FaCapsules size={14} color="var(--accent)" />
                          <span style={{ fontSize: "14px", color: "var(--text)" }}>
                            {medication}
                          </span>
                        </div>
                      )
                    )
                  )}
                </div>
              </section>

              <section style={{ display: "grid", gap: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <FaClock size={16} color="var(--accent)" />
                  <h2 style={{ margin: 0, fontSize: "18px" }}>Clinical Notes</h2>
                </div>

                <div
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "16px",
                    padding: "18px",
                    background: "var(--surface-alt)",
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        marginBottom: "6px",
                      }}
                    >
                      Diagnosis
                    </div>
                    <div style={{ fontSize: "14px", color: "var(--text)" }}>
                      {selectedPrescription.diagnosis || "No diagnosis recorded."}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        marginBottom: "6px",
                      }}
                    >
                      Treatment Plan
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: "var(--text)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {selectedPrescription.treatmentPlan ||
                        "No treatment plan recorded."}
                    </div>
                  </div>
                </div>
              </section>

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
                  onClick={() => setSelectedPrescription(null)}
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
                  Close
                </button>

                <button
                  type="button"
                  onClick={dispenseMedication}
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
                  Dispense Medication
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: "56px 24px",
                textAlign: "center",
                color: "var(--muted)",
                display: "grid",
                gap: "14px",
              }}
            >
              <FaPills size={44} style={{ justifySelf: "center" }} />
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                Select a prescription from the queue
              </div>
              <div style={{ fontSize: "14px" }}>
                Completed clinical consultations with treatment plans will appear
                here for dispensing.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dispensing History */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "var(--shadow)",
          display: "grid",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "18px" }}>Dispensing History</h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "var(--muted)",
                fontSize: "14px",
              }}
            >
              Recently dispensed prescriptions.
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderRadius: "999px",
              background: "rgba(22, 163, 74, 0.12)",
              color: "#166534",
              fontWeight: 700,
              fontSize: "12px",
            }}
          >
            <FaCheckCircle size={12} />
            {dispensed.length} dispensed
          </div>
        </div>

        {dispensed.length === 0 ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--muted)",
              border: "1px dashed var(--line)",
              borderRadius: "16px",
              fontSize: "14px",
            }}
          >
            No medications have been dispensed yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  <th style={thStyle}>Patient</th>
                  <th style={thStyle}>MPI</th>
                  <th style={thStyle}>Medications</th>
                  <th style={thStyle}>Dispensed At</th>
                </tr>
              </thead>

              <tbody>
                {dispensed.map((record) => (
                  <tr
                    key={record.id}
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <td style={tdStyle}>{record.patientName}</td>
                    <td style={tdStyle}>{record.mpi}</td>
                    <td style={tdStyle}>
                      {record.medications.join(", ") || "No medications"}
                    </td>
                    <td style={tdStyle}>
                      {new Date(record.dispensedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: "16px",
        padding: "16px",
        background: "var(--surface-alt)",
        display: "grid",
        gap: "6px",
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>

      <div style={{ fontSize: "14px", color: "var(--ink)", fontWeight: 600 }}>
        {value || "—"}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "14px 18px",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "16px 18px",
  fontSize: "14px",
  color: "var(--text)",
};
