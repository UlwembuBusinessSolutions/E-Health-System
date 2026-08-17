import {
  FaPills,
  FaFilePrescription,
  FaBoxes,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaSearch,
} from "react-icons/fa";

const pendingPrescriptions = [
  {
    id: "RX-1001",
    patient: "Thandi Mokoena",
    medication: "Amoxicillin 500mg",
    status: "Ready",
  },
  {
    id: "RX-1002",
    patient: "Sipho Dlamini",
    medication: "Paracetamol 500mg",
    status: "Awaiting Verification",
  },
  {
    id: "RX-1003",
    patient: "Lerato Khumalo",
    medication: "Salbutamol Inhaler",
    status: "Ready",
  },
];

const lowStockItems = [
  { name: "Amoxicillin 500mg", remaining: 12 },
  { name: "Ibuprofen 400mg", remaining: 8 },
  { name: "Salbutamol Inhaler", remaining: 5 },
];

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const statusStyles = {
  Ready: { background: "#dcfce7", color: "#166534" },
  "Awaiting Verification": {
    background: "#fef3c7",
    color: "#92400e",
  },
};

export default function PharmacyDashboard() {
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
            <FaPills size={12} />
            Medication Management
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Pharmacy Dashboard
          </h1>

          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            Dispense prescriptions, monitor inventory levels, and manage pharmacy
            operations across the clinic.
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
          <FaFilePrescription size={14} />
          New Dispensing
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
            Pending Prescriptions
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            14
          </div>
          <div style={{ marginTop: "6px", color: "#92400e", fontSize: "13px" }}>
            3 awaiting verification
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Dispensed Today
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
          <div style={{ marginTop: "6px", color: "#166534", fontSize: "13px" }}>
            +9% from yesterday
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Inventory Items
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            482
          </div>
          <div style={{ marginTop: "6px", color: "#0f766e", fontSize: "13px" }}>
            97% stock availability
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Low Stock Alerts
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            3
          </div>
          <div style={{ marginTop: "6px", color: "#dc2626", fontSize: "13px" }}>
            Immediate reorder recommended
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
              Find Prescription or Medication
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              Search by patient name, prescription number, or medication name.
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
            placeholder="Search prescriptions, patients, or medications"
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

      {/* Main Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
        }}
      >
        {/* Pending Prescriptions */}
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
                Pending Prescriptions
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Prescriptions received from Clinical and awaiting dispensing.
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
                  <th style={{ padding: "12px 0" }}>Prescription</th>
                  <th style={{ padding: "12px 0" }}>Patient</th>
                  <th style={{ padding: "12px 0" }}>Medication</th>
                  <th style={{ padding: "12px 0" }}>Status</th>
                  <th style={{ padding: "12px 0" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {pendingPrescriptions.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "14px 0", fontWeight: 700 }}>
                      {item.id}
                    </td>

                    <td style={{ padding: "14px 0" }}>{item.patient}</td>

                    <td style={{ padding: "14px 0" }}>{item.medication}</td>

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
                        <FaCheckCircle size={12} />
                        Dispense
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <FaExclamationTriangle size={18} color="#dc2626" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Low Stock Alerts
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Items approaching minimum stock threshold.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {lowStockItems.map((item) => (
              <div
                key={item.name}
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a" }}>
                  {item.name}
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "13px",
                    color: "#b91c1c",
                  }}
                >
                  {item.remaining} units remaining
                </div>
              </div>
            ))}
          </div>

          <button
            style={{
              width: "100%",
              marginTop: "18px",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1px solid #fecaca",
              background: "#ffffff",
              color: "#b91c1c",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Generate Reorder Request
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        <button
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            gap: "14px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <FaFilePrescription size={24} color="#0f766e" />
          <div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>
              Prescription Dispensing
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
              Verify and dispense prescribed medication.
            </div>
          </div>
        </button>

        <button
          style={{
            ...cardStyle,
            display: "flex",
            alignItems: "center",
            gap: "14px",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <FaBoxes size={24} color="#0f766e" />
          <div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>
              Medication Inventory
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
              Review stock levels, batches, and expiries.
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
