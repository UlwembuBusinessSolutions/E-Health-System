import {
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaReceipt,
  FaShieldAlt,
  FaChartLine,
  FaExclamationCircle,
  FaSearch,
  FaCheckCircle,
} from "react-icons/fa";

const recentInvoices = [
  {
    invoice: "INV-2026-00124",
    patient: "Thandi Mokoena",
    amount: "R 450.00",
    status: "Paid",
  },
  {
    invoice: "INV-2026-00125",
    patient: "Sipho Dlamini",
    amount: "R 320.00",
    status: "Pending",
  },
  {
    invoice: "INV-2026-00126",
    patient: "Lerato Khumalo",
    amount: "R 780.00",
    status: "Claim Submitted",
  },
];

const outstandingAccounts = [
  { patient: "Musa Nkosi", amount: "R 1,240.00", days: "14 days" },
  { patient: "Nomsa Khumalo", amount: "R 860.00", days: "21 days" },
  { patient: "Peter Maseko", amount: "R 2,150.00", days: "30 days" },
];

const statusStyles = {
  Paid: { background: "#dcfce7", color: "#166534" },
  Pending: { background: "#fef3c7", color: "#92400e" },
  "Claim Submitted": { background: "#dbeafe", color: "#1d4ed8" },
};

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "22px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

export default function BillingDashboard() {
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
            <FaFileInvoiceDollar size={12} />
            Financial Operations
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Billing Dashboard
          </h1>

          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            Manage invoices, payments, medical aid claims, and revenue monitoring
            for Ulwembu Healthcare facilities.
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
          <FaFileInvoiceDollar size={14} />
          Create Invoice
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Invoices Today
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            42
          </div>
          <div style={{ marginTop: "6px", color: "#0f766e", fontSize: "13px" }}>
            R 18,460 billed
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Payments Received
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            R 14,280
          </div>
          <div style={{ marginTop: "6px", color: "#166534", fontSize: "13px" }}>
            77% collection rate
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Medical Aid Claims
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            16
          </div>
          <div style={{ marginTop: "6px", color: "#1d4ed8", fontSize: "13px" }}>
            3 awaiting response
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ color: "#64748b", fontSize: "13px" }}>
            Outstanding Accounts
          </div>
          <div
            style={{
              marginTop: "10px",
              fontSize: "2rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            R 8,950
          </div>
          <div style={{ marginTop: "6px", color: "#dc2626", fontSize: "13px" }}>
            Follow-up required
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
              Find Invoice or Account
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              Search by invoice number, patient name, or medical aid reference.
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
            placeholder="Search invoices, patients, claims, or accounts"
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
        {/* Recent Invoices */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <FaReceipt size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Recent Invoices
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Latest billing activity generated from consultations and pharmacy
                dispensing.
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
                  <th style={{ padding: "12px 0" }}>Invoice</th>
                  <th style={{ padding: "12px 0" }}>Patient</th>
                  <th style={{ padding: "12px 0" }}>Amount</th>
                  <th style={{ padding: "12px 0" }}>Status</th>
                </tr>
              </thead>

              <tbody>
                {recentInvoices.map((item) => (
                  <tr
                    key={item.invoice}
                    style={{ borderBottom: "1px solid #f1f5f9" }}
                  >
                    <td style={{ padding: "14px 0", fontWeight: 700 }}>
                      {item.invoice}
                    </td>

                    <td style={{ padding: "14px 0" }}>{item.patient}</td>

                    <td style={{ padding: "14px 0", fontWeight: 600 }}>
                      {item.amount}
                    </td>

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Outstanding Accounts */}
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "18px",
            }}
          >
            <FaExclamationCircle size={18} color="#dc2626" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Outstanding Accounts
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Accounts requiring payment follow-up or collections action.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {outstandingAccounts.map((item) => (
              <div
                key={item.patient}
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                }}
              >
                <div style={{ fontWeight: 700, color: "#0f172a" }}>
                  {item.patient}
                </div>
                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "13px",
                    color: "#64748b",
                  }}
                >
                  {item.amount} · {item.days}
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
            Generate Follow-Up Report
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
          <FaMoneyBillWave size={24} color="#0f766e" />
          <div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>
              Record Payment
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
              Capture cash, card, EFT, or mobile payments.
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
          <FaShieldAlt size={24} color="#0f766e" />
          <div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>
              Medical Aid Claims
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
              Submit and track medical aid reimbursement claims.
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
          <FaChartLine size={24} color="#0f766e" />
          <div>
            <div style={{ fontWeight: 700, color: "#0f172a" }}>
              Revenue Monitoring
            </div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
              Review collections, claims, and outstanding balances.
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
