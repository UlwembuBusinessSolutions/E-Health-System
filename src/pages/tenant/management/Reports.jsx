import {
  FaChartBar,
  FaUsers,
  FaStethoscope,
  FaPills,
  FaMoneyBillWave,
  FaShieldAlt,
  FaDownload,
  FaCalendarAlt,
} from "react-icons/fa";

const reportCards = [
  {
    icon: <FaUsers size={22} color="#0f766e" />,
    title: "Patient Visits",
    value: "1,284",
    subtitle: "+12% from last month",
  },
  {
    icon: <FaStethoscope size={22} color="#2563eb" />,
    title: "Consultations Completed",
    value: "932",
    subtitle: "Average 38 per day",
  },
  {
    icon: <FaPills size={22} color="#7c3aed" />,
    title: "Prescriptions Dispensed",
    value: "1,106",
    subtitle: "94% fulfilled successfully",
  },
  {
    icon: <FaMoneyBillWave size={22} color="#ea580c" />,
    title: "Revenue Collected",
    value: "R 482,560",
    subtitle: "81% collection rate",
  },
];

const topFacilities = [
  {
    facility: "Mamelodi West Clinic",
    visits: 428,
    revenue: "R 148,200",
  },
  {
    facility: "Mamelodi East Clinic",
    visits: 376,
    revenue: "R 129,450",
  },
  {
    facility: "Pretoria Community Clinic",
    visits: 294,
    revenue: "R 104,300",
  },
  {
    facility: "Ulwembu Primary Care Centre",
    visits: 186,
    revenue: "R 100,610",
  },
];

const complianceItems = [
  {
    label: "Audit logs exported",
    status: "Completed",
  },
  {
    label: "Pharmacy stock variance review",
    status: "Pending",
  },
  {
    label: "Medical aid reconciliation",
    status: "In Progress",
  },
];

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const statusStyles = {
  Completed: { background: "#dcfce7", color: "#166534" },
  Pending: { background: "#fef3c7", color: "#92400e" },
  "In Progress": { background: "#dbeafe", color: "#1d4ed8" },
};

export default function Reports() {
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
            <FaChartBar size={12} />
            Management Intelligence
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Reports & Analytics
          </h1>

          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            Executive reporting, operational analytics, and compliance insights
            across the Ulwembu Healthcare platform.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <FaCalendarAlt size={14} />
            This Month
          </button>

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
            <FaDownload size={14} />
            Export Report Pack
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        {reportCards.map((card) => (
          <div key={card.title} style={cardStyle}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "14px",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {card.icon}
            </div>

            <div style={{ marginTop: "18px" }}>
              <div style={{ fontSize: "13px", color: "#64748b" }}>
                {card.title}
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "2rem",
                  fontWeight: 800,
                  color: "#0f172a",
                }}
              >
                {card.value}
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                  color: "#0f766e",
                }}
              >
                {card.subtitle}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
        }}
      >
        {/* Facility Performance */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <FaChartBar size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Facility Performance
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Top-performing clinics by patient visits and revenue generated.
              </p>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color: "#64748b",
                    borderBottom: "1px solid #e2e8f0",
                  }}
                >
                  <th style={{ padding: "12px 0" }}>Facility</th>
                  <th style={{ padding: "12px 0" }}>Visits</th>
                  <th style={{ padding: "12px 0" }}>Revenue</th>
                </tr>
              </thead>

              <tbody>
                {topFacilities.map((item) => (
                  <tr
                    key={item.facility}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "14px 0", fontWeight: 600 }}>
                      {item.facility}
                    </td>
                    <td style={{ padding: "14px 0" }}>{item.visits}</td>
                    <td style={{ padding: "14px 0", fontWeight: 700 }}>
                      {item.revenue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compliance Snapshot */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <FaShieldAlt size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Compliance Snapshot
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Current audit and operational compliance indicators.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {complianceItems.map((item) => (
              <div
                key={item.label}
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div style={{ fontWeight: 600, color: "#0f172a" }}>
                  {item.label}
                </div>

                <span
                  style={{
                    padding: "6px 12px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 700,
                    ...statusStyles[item.status],
                  }}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Report Categories */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        {[
          {
            icon: <FaUsers size={22} color="#0f766e" />,
            title: "Patient Analytics",
            description:
              "Daily visits, demographics, and registration trends.",
          },
          {
            icon: <FaStethoscope size={22} color="#2563eb" />,
            title: "Clinical Activity",
            description:
              "Consultations, diagnoses, referrals, and follow-ups.",
          },
          {
            icon: <FaPills size={22} color="#7c3aed" />,
            title: "Pharmacy Reports",
            description:
              "Dispensing volumes, stock movement, and expiry monitoring.",
          },
          {
            icon: <FaMoneyBillWave size={22} color="#ea580c" />,
            title: "Financial Reports",
            description:
              "Revenue, collections, claims, and outstanding accounts.",
          },
        ].map((item) => (
          <button
            key={item.title}
            style={{
              ...cardStyle,
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {item.icon}
            </div>

            <div>
              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                {item.title}
              </div>
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                  color: "#64748b",
                  lineHeight: 1.5,
                }}
              >
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
