import {
  FaGraduationCap,
  FaCertificate,
  FaCalendarAlt,
  FaUsers,
  FaUpload,
  FaPlus,
} from "react-icons/fa";

const trainings = [
  {
    course: "POPIA & Patient Confidentiality",
    department: "All Staff",
    due: "2026-09-15",
    status: "Completed",
  },
  {
    course: "Infection Prevention & Control",
    department: "Clinical Services",
    due: "2026-08-30",
    status: "In Progress",
  },
  {
    course: "Medicine Dispensing Compliance",
    department: "Pharmacy",
    due: "2026-07-31",
    status: "Expired",
  },
];

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
};

const buttonStyle = {
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

function StatusBadge({ status }) {
  const colors = {
    Completed: { background: "#dcfce7", color: "#166534" },
    "In Progress": { background: "#fef3c7", color: "#b45309" },
    Expired: { background: "#fee2e2", color: "#dc2626" },
  };

  return (
    <span
      style={{
        ...colors[status],
        padding: "6px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {status}
    </span>
  );
}

export default function Training() {
  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "28px",
            gap: "16px",
          }}
        >
          <div>
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
              Management
            </div>

            <h1 style={{ fontSize: "44px", margin: 0, color: "#0f172a" }}>
              Training Management
            </h1>

            <p style={{ color: "#64748b", fontSize: "16px", marginTop: "12px" }}>
              Track staff training, certifications, compliance courses, and continuing professional development requirements across the organisation.
            </p>
          </div>

          <button style={buttonStyle}>
            <FaPlus size={12} />
            New Training Course
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
            marginBottom: "28px",
          }}
        >
          <StatCard icon={<FaGraduationCap size={20} />} label="Active Courses" value="12" />
          <StatCard icon={<FaUsers size={20} />} label="Staff Enrolled" value="84" />
          <StatCard icon={<FaCertificate size={20} />} label="Certificates Issued" value="46" />
          <StatCard icon={<FaCalendarAlt size={20} />} label="Expiring This Month" value="3" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "24px",
          }}
        >
          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#0f172a" }}>Training Register</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                    Monitor mandatory and departmental training requirements.
                  </p>
                </div>

                <button
                  style={{
                    background: "#ffffff",
                    border: "1px solid #dbe7e4",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#334155",
                  }}
                >
                  View Calendar
                </button>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={tableHead}>Course</th>
                      <th style={tableHead}>Department</th>
                      <th style={tableHead}>Due Date</th>
                      <th style={tableHead}>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {trainings.map((training) => (
                      <tr key={training.course} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={tableCell}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{training.course}</div>
                        </td>
                        <td style={tableCell}>{training.department}</td>
                        <td style={tableCell}>{training.due}</td>
                        <td style={tableCell}>
                          <StatusBadge status={training.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Upcoming Sessions</h2>

              <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
                <SessionItem
                  title="POPIA Refresher Workshop"
                  date="15 Aug 2026 · 09:00"
                  attendees="24 attendees registered"
                />
                <SessionItem
                  title="Emergency Triage Procedures"
                  date="20 Aug 2026 · 14:00"
                  attendees="16 attendees registered"
                />
                <SessionItem
                  title="Pharmacy Controlled Substances Compliance"
                  date="28 Aug 2026 · 10:30"
                  attendees="8 attendees registered"
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px", alignContent: "start" }}>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Certification Upload</h2>

              <div
                style={{
                  border: "1px dashed #cbd5e1",
                  borderRadius: "16px",
                  padding: "28px",
                  textAlign: "center",
                  background: "#f8fafc",
                  marginTop: "18px",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "18px",
                    background: "#ffffff",
                    border: "1px solid #dbe7e4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    color: "#0f766e",
                  }}
                >
                  <FaUpload size={28} />
                </div>

                <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                  Upload training certificate
                </div>

                <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
                  PDF, JPG, or PNG · maximum file size 10MB
                </div>

                <input type="file" accept=".pdf,.png,.jpg,.jpeg" style={{ fontSize: "14px" }} />
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Compliance Training Status</h2>

              <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
                <ComplianceRow label="POPIA & Confidentiality" value="92%" />
                <ComplianceRow label="Infection Control" value="84%" />
                <ComplianceRow label="Health & Safety Induction" value="97%" />
                <ComplianceRow label="Medication Handling" value="76%" />
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

function SessionItem({ title, date, attendees }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "16px",
        background: "#f8fafc",
      }}
    >
      <div style={{ fontWeight: 600, color: "#0f172a" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "#64748b", marginTop: "6px" }}>{date}</div>
      <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px" }}>{attendees}</div>
    </div>
  );
}

function ComplianceRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
      <span style={{ color: "#334155", fontSize: "14px" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#0f766e" }}>{value}</span>
    </div>
  );
}

const tableHead = {
  padding: "12px 14px",
  fontSize: "12px",
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tableCell = {
  padding: "14px",
  fontSize: "14px",
  color: "#334155",
};