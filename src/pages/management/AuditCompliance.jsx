import { useMemo, useState } from "react";
import {
  FaSearch,
  FaDownload,
  FaFilter,
  FaShieldAlt,
  FaUserShield,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
} from "react-icons/fa";

const auditRecords = [
  {
    id: "AUD-1001",
    date: "13 Aug 2026",
    time: "19:31",
    user: "Amo Admin",
    role: "Tenant Administrator",
    action: "Updated organisation branding",
    module: "Organisation",
    target: "Mamelodi Health Services",
    status: "Success",
    risk: "Low",
  },
  {
    id: "AUD-1002",
    date: "13 Aug 2026",
    time: "19:12",
    user: "Dr. Mokoena",
    role: "Clinician",
    action: "Updated patient consultation",
    module: "Clinical",
    target: "PAT-00241",
    status: "Success",
    risk: "Low",
  },
  {
    id: "AUD-1003",
    date: "13 Aug 2026",
    time: "18:54",
    user: "Pharmacy User",
    role: "Pharmacist",
    action: "Dispensed prescription",
    module: "Pharmacy",
    target: "RX-00842",
    status: "Success",
    risk: "Low",
  },
  {
    id: "AUD-1004",
    date: "13 Aug 2026",
    time: "18:42",
    user: "Finance User",
    role: "Financial Administrator",
    action: "Created invoice",
    module: "Billing",
    target: "INV-01482",
    status: "Success",
    risk: "Low",
  },
  {
    id: "AUD-1005",
    date: "13 Aug 2026",
    time: "18:17",
    user: "Unknown User",
    role: "Unknown",
    action: "Failed login attempt",
    module: "Authentication",
    target: "Amo Admin",
    status: "Failed",
    risk: "High",
  },
  {
    id: "AUD-1006",
    date: "13 Aug 2026",
    time: "17:56",
    user: "Amo Admin",
    role: "Tenant Administrator",
    action: "Added new staff member",
    module: "Staff & Users",
    target: "STF-00318",
    status: "Success",
    risk: "Medium",
  },
];

const statCards = [
  {
    label: "Events Today",
    value: "248",
    detail: "+12% from yesterday",
    icon: FaClock,
  },
  {
    label: "Successful Actions",
    value: "239",
    detail: "96.4% of all events",
    icon: FaCheckCircle,
  },
  {
    label: "Security Events",
    value: "7",
    detail: "3 require review",
    icon: FaShieldAlt,
  },
  {
    label: "High Risk Events",
    value: "2",
    detail: "Immediate attention",
    icon: FaExclamationTriangle,
  },
];

function StatCard({ label, value, detail, icon: Icon }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "18px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "14px",
          background: "#ecfdf5",
          color: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={19} />
      </div>

      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#64748b",
            marginBottom: "4px",
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            marginTop: "3px",
          }}
        >
          {detail}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const success = status === "Success";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 9px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        background: success ? "#dcfce7" : "#fee2e2",
        color: success ? "#166534" : "#b91c1c",
      }}
    >
      {status}
    </span>
  );
}

function RiskBadge({ risk }) {
  const styles = {
    Low: {
      background: "#f1f5f9",
      color: "#475569",
    },
    Medium: {
      background: "#fef3c7",
      color: "#92400e",
    },
    High: {
      background: "#fee2e2",
      color: "#b91c1c",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 9px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        ...styles[risk],
      }}
    >
      {risk}
    </span>
  );
}

export default function AuditCompliance() {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");

  const filteredRecords = useMemo(() => {
    const query = search.trim().toLowerCase();

    return auditRecords.filter((record) => {
      const matchesSearch =
        !query ||
        record.user.toLowerCase().includes(query) ||
        record.action.toLowerCase().includes(query) ||
        record.target.toLowerCase().includes(query) ||
        record.module.toLowerCase().includes(query);

      const matchesModule =
        moduleFilter === "All" || record.module === moduleFilter;

      const matchesRisk =
        riskFilter === "All" || record.risk === riskFilter;

      return matchesSearch && matchesModule && matchesRisk;
    });
  }, [search, moduleFilter, riskFilter]);

  return (
    <div
      style={{
        display: "grid",
        gap: "24px",
        paddingBottom: "32px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                background: "#ecfdf5",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FaShieldAlt />
            </div>

            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#0f766e",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Security & Governance
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              color: "#0f172a",
              fontSize: "30px",
              fontWeight: 800,
            }}
          >
            Audit & Compliance
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Monitor user activity, security events, record access and
            compliance-related actions across the organisation.
          </p>
        </div>

        <button
          type="button"
          onClick={() => alert("Audit report export will be connected to the API.")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            border: "none",
            borderRadius: "12px",
            background: "#0f766e",
            color: "#ffffff",
            padding: "11px 16px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FaDownload />
          Export Audit Report
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
        }}
      >
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Compliance summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "18px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
            }}
          >
            <strong style={{ color: "#0f172a" }}>
              Access Compliance
            </strong>

            <FaUserShield color="#0f766e" />
          </div>

          <div
            style={{
              height: "9px",
              background: "#e2e8f0",
              borderRadius: "999px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "94%",
                height: "100%",
                background: "#0f766e",
                borderRadius: "999px",
              }}
            />
          </div>

          <div
            style={{
              marginTop: "9px",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            <span>Compliant access</span>
            <strong style={{ color: "#0f766e" }}>94%</strong>
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "18px",
            padding: "20px",
          }}
        >
          <strong style={{ color: "#0f172a" }}>
            Security Review
          </strong>

          <p
            style={{
              color: "#64748b",
              fontSize: "13px",
              lineHeight: 1.6,
              margin: "12px 0",
            }}
          >
            Two high-risk events require administrator review before the
            current compliance cycle can be closed.
          </p>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              background: "#fef3c7",
              color: "#92400e",
              padding: "7px 10px",
              borderRadius: "9px",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            <FaExclamationTriangle />
            Review required
          </span>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "18px",
            padding: "20px",
          }}
        >
          <strong style={{ color: "#0f172a" }}>
            Record Access Monitoring
          </strong>

          <p
            style={{
              color: "#64748b",
              fontSize: "13px",
              lineHeight: 1.6,
              margin: "12px 0",
            }}
          >
            Patient record access is being monitored across clinical,
            pharmacy, reception and billing modules.
          </p>

          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              color: "#166534",
              background: "#dcfce7",
              padding: "7px 10px",
              borderRadius: "9px",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            <FaCheckCircle />
            Monitoring active
          </span>
        </div>
      </div>

      {/* Audit table */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 4px 14px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  color: "#0f172a",
                }}
              >
                Audit Event Log
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: "12px",
                  color: "#94a3b8",
                }}
              >
                Recent activity across the Ulwembu Healthcare platform.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#64748b",
                fontSize: "12px",
              }}
            >
              <FaFilter />
              {filteredRecords.length} events
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) 170px 140px",
              gap: "10px",
            }}
          >
            <div style={{ position: "relative" }}>
              <FaSearch
                size={13}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search audit events..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid #dbe3ea",
                  borderRadius: "10px",
                  padding: "10px 12px 10px 34px",
                  outline: "none",
                  fontSize: "13px",
                }}
              />
            </div>

            <select
              value={moduleFilter}
              onChange={(event) => setModuleFilter(event.target.value)}
              style={{
                border: "1px solid #dbe3ea",
                borderRadius: "10px",
                padding: "10px",
                fontSize: "13px",
                background: "#ffffff",
              }}
            >
              <option value="All">All Modules</option>
              <option value="Organisation">Organisation</option>
              <option value="Clinical">Clinical</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Billing">Billing</option>
              <option value="Authentication">Authentication</option>
              <option value="Staff & Users">Staff & Users</option>
            </select>

            <select
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value)}
              style={{
                border: "1px solid #dbe3ea",
                borderRadius: "10px",
                padding: "10px",
                fontSize: "13px",
                background: "#ffffff",
              }}
            >
              <option value="All">All Risk</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "950px",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {[
                  "Date / Time",
                  "User",
                  "Action",
                  "Module",
                  "Target",
                  "Status",
                  "Risk",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "13px 16px",
                      textAlign: "left",
                      fontSize: "11px",
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      borderBottom: "1px solid #e2e8f0",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td
                    style={{
                      padding: "15px 16px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "12px",
                        color: "#0f172a",
                      }}
                    >
                      {record.date}
                    </div>

                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "11px",
                        marginTop: "3px",
                      }}
                    >
                      {record.time}
                    </div>
                  </td>

                  <td
                    style={{
                      padding: "15px 16px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "13px",
                        color: "#0f172a",
                      }}
                    >
                      {record.user}
                    </div>

                    <div
                      style={{
                        color: "#94a3b8",
                        fontSize: "11px",
                        marginTop: "3px",
                      }}
                    >
                      {record.role}
                    </div>
                  </td>

                  <td
                    style={{
                      padding: "15px 16px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "13px",
                      color: "#334155",
                    }}
                  >
                    {record.action}
                  </td>

                  <td
                    style={{
                      padding: "15px 16px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "12px",
                      color: "#475569",
                    }}
                  >
                    {record.module}
                  </td>

                  <td
                    style={{
                      padding: "15px 16px",
                      borderBottom: "1px solid #f1f5f9",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#475569",
                    }}
                  >
                    {record.target}
                  </td>

                  <td
                    style={{
                      padding: "15px 16px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <StatusBadge status={record.status} />
                  </td>

                  <td
                    style={{
                      padding: "15px 16px",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <RiskBadge risk={record.risk} />
                  </td>
                </tr>
              ))}

              {filteredRecords.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    No audit events match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}