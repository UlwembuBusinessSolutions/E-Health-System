import {
  FaUserInjured,
  FaHeartbeat,
  FaNotesMedical,
  FaPrescriptionBottleAlt,
  FaFlask,
  FaArrowRight,
} from "react-icons/fa";

const waitingPatients = [
  { name: "Nomsa Dlamini", token: "A001", reason: "General Consultation" },
  { name: "Thabo Mokoena", token: "A002", reason: "Walk-in Review" },
  { name: "Lerato Nkosi", token: "A003", reason: "Follow-up Visit" },
];

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
};

export default function ClinicalDashboard() {
  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              color: "#64748b",
              fontSize: "14px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            Clinical Services
          </div>

          <h1 style={{ fontSize: "44px", margin: 0, color: "#0f172a" }}>
            Clinical Dashboard
          </h1>

          <p style={{ color: "#64748b", fontSize: "16px", marginTop: "12px" }}>
            Manage consultations, capture vitals, record diagnoses, prescribe medication, and coordinate laboratory and referral workflows.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
            marginBottom: "28px",
          }}
        >
          <StatCard icon={<FaUserInjured size={20} />} label="Patients Waiting" value="14" />
          <StatCard icon={<FaHeartbeat size={20} />} label="Vitals Pending" value="5" />
          <StatCard icon={<FaNotesMedical size={20} />} label="Consultations Today" value="27" />
          <StatCard icon={<FaPrescriptionBottleAlt size={20} />} label="Prescriptions Issued" value="19" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "24px",
          }}
        >
          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#0f172a" }}>Patients Awaiting Consultation</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                    Queue items ready for clinical review.
                  </p>
                </div>

                <button style={secondaryButton}>Refresh Queue</button>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {waitingPatients.map((patient) => (
                  <div
                    key={patient.token}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "12px",
                          background: "#ecfeff",
                          color: "#0f766e",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                      >
                        {patient.token}
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{patient.name}</div>
                        <div style={{ fontSize: "13px", color: "#64748b" }}>{patient.reason}</div>
                      </div>
                    </div>

                    <button style={primaryButton}>
                      Open Encounter
                      <FaArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Clinical Workflow</h2>

              <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
                <WorkflowStep title="1. Search Patient" description="Find the patient record by ID, token, or name." />
                <WorkflowStep title="2. Capture Vitals" description="Record temperature, blood pressure, pulse, and oxygen saturation." />
                <WorkflowStep title="3. Consultation Notes" description="Document symptoms, examination findings, and treatment decisions." />
                <WorkflowStep title="4. Orders & Referrals" description="Request laboratory tests, imaging, prescriptions, and specialist referrals." />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Quick Clinical Actions</h2>

              <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
                <button style={actionButton}>Search Patient Record</button>
                <button style={actionButton}>Capture Vitals</button>
                <button style={actionButton}>Start Consultation</button>
                <button style={actionButton}>Create Prescription</button>
                <button style={actionButton}>Request Laboratory Test</button>
                <button style={actionButton}>Create Referral</button>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                <FaFlask size={18} color="#0f766e" />
                <h2 style={{ margin: 0, color: "#0f172a" }}>Laboratory Requests</h2>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                <LabItem test="Full Blood Count" patient="Nomsa Dlamini" status="Pending collection" />
                <LabItem test="HbA1c" patient="Sipho Khumalo" status="In laboratory" />
                <LabItem test="Urinalysis" patient="Ayanda Maseko" status="Results ready" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: "#ecfeff",
          color: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
        }}
      >
        {icon}
      </div>

      <div style={{ fontSize: "14px", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: "32px", fontWeight: 700, color: "#0f172a", marginTop: "6px" }}>
        {value}
      </div>
    </div>
  );
}

function WorkflowStep({ title, description }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "16px",
        background: "#f8fafc",
      }}
    >
      <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

function LabItem({ test, patient, status }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 0",
        borderBottom: "1px solid #eef2f7",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: "#0f172a" }}>{test}</div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>{patient}</div>
      </div>

      <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f766e" }}>{status}</span>
    </div>
  );
}

const primaryButton = {
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const secondaryButton = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
  color: "#334155",
};

const actionButton = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #dbe7e4",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
};