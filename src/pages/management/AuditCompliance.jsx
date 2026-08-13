import {
  FaShieldAlt,
  FaUserClock,
  FaFileMedical,
  FaExclamationTriangle,
  FaDownload,
  FaSearch,
} from "react-icons/fa";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
};

const auditLogs = [
  {
    user: "Amo Admin",
    action: "Updated staff permissions",
    module: "Administration",
    time: "2026-08-07 10:14",
    severity: "Medium",
  },
  {
    user: "Dr. Nkosi",
    action: "Viewed patient clinical record",
    module: "Clinical Services",
    time: "2026-08-07 09:52",
    severity: "Low",
  },
  {
    user: "Reception Desk 1",
    action: "Modified appointment schedule",
    module: "Appointments",
    time: "2026-08-07 09:21",
    severity: "Low",
  },
  {
    user: "System",
    action: "Multiple failed login attempts detected",
    module: "Authentication",
    time: "2026-08-07 08:47",
    severity: "High",
  },
];

const complianceAlerts = [
  {
    title: "Failed login threshold exceeded",
    description: "3 failed login attempts detected for user account reception-west-02.",
    priority: "High",
  },
  {
    title: "Patient consent document missing",
    description: "2 newly registered patients do not have signed POPIA consent forms attached.",
    priority: "Medium",
  },
  {
    title: "Audit retention review due",
    description: "Quarterly audit retention review is scheduled for the current month.",
    priority: "Low",
  },
];

export default function AuditCompliance() {
  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px",
            marginBottom: "28px",
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
              Audit & Compliance
            </h1>

            <p style={{ color: "#64748b", fontSize: "16px", marginTop: "12px" }}>
              Monitor system activity, review compliance alerts, and maintain healthcare audit readiness across the Ulwembu Healthcare platform.
            </p>
          </div>

          <button
            style={{
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: "12px",
              padding: "12px 18px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <FaDownload size={14} />
            Export Audit Report
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
          <StatCard icon={<FaShieldAlt size={20} />} label="Audit Events Today" value="248" />
          <StatCard icon={<FaUserClock size={20} />} label="Active User Sessions" value="37" />
          <StatCard icon={<FaFileMedical size={20} />} label="Sensitive Record Accesses" value="61" />
          <StatCard icon={<FaExclamationTriangle size={20} />} label="Open Compliance Alerts" value="3" />
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, color: "#0f172a" }}>Audit Log Viewer</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                    Review recent security, operational, and clinical audit events.
                  </p>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    border: "1px solid #dbe7e4",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    minWidth: "220px",
                    background: "#f8fafc",
                  }}
                >
                  <FaSearch size={14} color="#64748b" />
                  <input
                    placeholder="Search audit events"
                    style={{
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      width: "100%",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "720px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={tableHead}>User</th>
                      <th style={tableHead}>Action</th>
                      <th style={tableHead}>Module</th>
                      <th style={tableHead}>Time</th>
                      <th style={tableHead}>Severity</th>
                    </tr>
                  </thead>

                  <tbody>
                    {auditLogs.map((log, index) => (
                      <tr key={index} style={{ borderTop: "1px solid #eef2f7" }}>
                        <td style={tableCell}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{log.user}</div>
                        </td>
                        <td style={tableCell}>{log.action}</td>
                        <td style={tableCell}>{log.module}</td>
                        <td style={tableCell}>{log.time}</td>
                        <td style={tableCell}>
                          <SeverityBadge severity={log.severity} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#0f172a" }}>User Access Monitoring</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                    Recent authenticated sessions and sensitive record access activity.
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
                  View Full History
                </button>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                <AccessItem
                  user="Dr. Nkosi"
                  detail="Accessed patient clinical summary · IP 10.0.1.24"
                  time="09:52"
                />
                <AccessItem
                  user="Pharmacy Desk A"
                  detail="Dispensed prescription RX-20418 · IP 10.0.1.41"
                  time="09:37"
                />
                <AccessItem
                  user="Reception Desk 1"
                  detail="Registered new patient encounter · IP 10.0.1.12"
                  time="09:18"
                />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px", alignContent: "start" }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                <FaExclamationTriangle size={18} color="#ea580c" />
                <h2 style={{ margin: 0, color: "#0f172a" }}>Compliance Alerts</h2>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {complianceAlerts.map((alert) => (
                  <div
                    key={alert.title}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      padding: "16px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{alert.title}</div>
                      <PriorityBadge priority={alert.priority} />
                    </div>

                    <div style={{ marginTop: "8px", fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
                      {alert.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Compliance Checklist</h2>

              <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
                <ChecklistItem label="POPIA consent records up to date" checked />
                <ChecklistItem label="Daily audit log retention completed" checked />
                <ChecklistItem label="Privileged account review pending" checked={false} />
                <ChecklistItem label="Quarterly compliance export generated" checked={false} />
              </div>

              <button
                style={{
                  width: "100%",
                  marginTop: "22px",
                  background: "#0f766e",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Generate Compliance Summary
              </button>
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

function SeverityBadge({ severity }) {
  const colors = {
    Low: { background: "#ecfdf5", color: "#047857" },
    Medium: { background: "#fef3c7", color: "#b45309" },
    High: { background: "#fee2e2", color: "#dc2626" },
  };

  return (
    <span
      style={{
        ...colors[severity],
        padding: "6px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {severity}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const colors = {
    Low: { background: "#e0f2fe", color: "#0369a1" },
    Medium: { background: "#fef3c7", color: "#b45309" },
    High: { background: "#fee2e2", color: "#dc2626" },
  };

  return (
    <span
      style={{
        ...colors[priority],
        padding: "6px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
      }}
    >
      {priority}
    </span>
  );
}

function AccessItem({ user, detail, time }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "12px",
        padding: "14px 0",
        borderBottom: "1px solid #eef2f7",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, color: "#0f172a" }}>{user}</div>
        <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
          {detail}
        </div>
      </div>

      <div style={{ fontSize: "12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
        {time}
      </div>
    </div>
  );
}

function ChecklistItem({ label, checked }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <input type="checkbox" checked={checked} readOnly />
      <span style={{ color: "#334155", fontSize: "14px" }}>{label}</span>
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