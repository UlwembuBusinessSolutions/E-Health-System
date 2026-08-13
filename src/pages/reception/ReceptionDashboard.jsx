import { useState } from "react";
import {
  FaSearch,
  FaUserCheck,
  FaClock,
  FaStethoscope,
  FaHeartbeat,
  FaCheckCircle,
} from "react-icons/fa";

const queueData = [
  {
    id: "Q-001",
    patient: "Thandi Mokoena",
    time: "08:12",
    status: "Waiting",
  },
  {
    id: "Q-002",
    patient: "Sipho Dlamini",
    time: "08:20",
    status: "Vitals",
  },
  {
    id: "Q-003",
    patient: "Lerato Khumalo",
    time: "08:34",
    status: "Consultation",
  },
  {
    id: "Q-004",
    patient: "Musa Nkosi",
    time: "08:45",
    status: "Waiting",
  },
];

const statusStyles = {
  Waiting: { background: "#fef3c7", color: "#92400e" },
  Vitals: { background: "#dbeafe", color: "#1d4ed8" },
  Consultation: { background: "#dcfce7", color: "#166534" },
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

export default function ReceptionDashboard() {
  const [search, setSearch] = useState("");

  const filteredQueue = queueData.filter((item) =>
    item.patient.toLowerCase().includes(search.toLowerCase())
  );

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
            <FaUserCheck size={12} />
            Front Desk Operations
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Reception & Queue Dashboard
          </h1>

          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            Manage patient arrivals, check-ins, and consultation queues across
            the clinic.
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
          <FaUserCheck size={14} />
          Check In Patient
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "18px",
        }}
      >
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Patients Waiting
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            12
          </div>
          <div style={{ marginTop: "6px", color: "#92400e", fontSize: "13px" }}>
            +2 in the last hour
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            In Vitals
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            4
          </div>
          <div style={{ marginTop: "6px", color: "#1d4ed8", fontSize: "13px" }}>
            Average 7 min wait
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Ready for Consultation
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            6
          </div>
          <div style={{ marginTop: "6px", color: "#166534", fontSize: "13px" }}>
            3 doctors available
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Completed Today
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            38
          </div>
          <div style={{ marginTop: "6px", color: "#0f766e", fontSize: "13px" }}>
            +14% vs yesterday
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <FaSearch size={18} color="#0f766e" />
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
              Find Patient
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              Search registered patients before check-in.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "12px",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by patient name, ID, or folder number"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
              boxSizing: "border-box",
            }}
          />

          <button
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <FaClock size={18} color="#0f766e" />
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
              Live Queue
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              Real-time patient flow for reception, vitals, and consultation.
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
                <th style={{ padding: "12px 0" }}>Queue No.</th>
                <th style={{ padding: "12px 0" }}>Patient</th>
                <th style={{ padding: "12px 0" }}>Arrival Time</th>
                <th style={{ padding: "12px 0" }}>Status</th>
                <th style={{ padding: "12px 0" }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredQueue.map((item) => (
                <tr
                  key={item.id}
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                >
                  <td style={{ padding: "14px 0", fontWeight: 700 }}>
                    {item.id}
                  </td>

                  <td style={{ padding: "14px 0" }}>
                    {item.patient}
                  </td>

                  <td style={{ padding: "14px 0" }}>{item.time}</td>

                  <td style={{ padding: "14px 0" }}>
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
                  </td>

                  <td style={{ padding: "14px 0" }}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        style={{
                          padding: "8px 12px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "13px",
                          fontWeight: 600,
                        }}
                      >
                        <FaHeartbeat size={12} />
                        Vitals
                      </button>

                      <button
                        style={{
                          padding: "8px 12px",
                          borderRadius: "10px",
                          border: "none",
                          background: "#0f766e",
                          color: "#ffffff",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "13px",
                          fontWeight: 700,
                        }}
                      >
                        <FaStethoscope size={12} />
                        Consult
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Queue Flow */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <FaUserCheck size={18} color="#92400e" />
            <h3 style={{ margin: 0, color: "#0f172a" }}>Waiting</h3>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#f8fafc" }}>
              Thandi Mokoena
            </div>
            <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#f8fafc" }}>
              Musa Nkosi
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <FaHeartbeat size={18} color="#1d4ed8" />
            <h3 style={{ margin: 0, color: "#0f172a" }}>Vitals</h3>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#eff6ff" }}>
              Sipho Dlamini
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
            }}
          >
            <FaCheckCircle size={18} color="#166534" />
            <h3 style={{ margin: 0, color: "#0f172a" }}>Ready for Doctor</h3>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <div style={{ padding: "10px 12px", borderRadius: "12px", background: "#ecfdf5" }}>
              Lerato Khumalo
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}