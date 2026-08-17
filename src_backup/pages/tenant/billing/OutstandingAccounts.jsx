import { FaExclamationTriangle, FaFileInvoiceDollar, FaPhone, FaEnvelope } from "react-icons/fa";

const accounts = [
  { patient: "Thabo Mokoena", invoice: "INV-2026-002", amount: "R320", days: 12 },
  { patient: "Lerato Nkosi", invoice: "INV-2026-014", amount: "R780", days: 34 },
  { patient: "Sipho Khumalo", invoice: "INV-2026-021", amount: "R1,250", days: 47 },
  { patient: "Ayanda Maseko", invoice: "INV-2026-028", amount: "R540", days: 63 },
];

export default function OutstandingAccounts() {
  const totalOutstanding = accounts.reduce((sum, account) => sum + Number(account.amount.replace(/[^\d]/g, "")), 0);

  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "28px" }}>
          <div style={eyebrowStyle}>Billing / Outstanding Accounts</div>
          <h1 style={{ fontSize: "42px", margin: 0, color: "#0f172a" }}>
            Outstanding Account Management
          </h1>
          <p style={{ color: "#64748b", marginTop: "10px", fontSize: "15px" }}>
            Track unpaid invoices, overdue balances, collection priorities, and follow-up actions for patient accounts and medical aid recoveries.
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
          <SummaryCard icon={<FaFileInvoiceDollar size={20} />} label="Open Invoices" value="4" />
          <SummaryCard icon={<FaExclamationTriangle size={20} />} label="Overdue Accounts" value="3" />
          <SummaryCard icon={<FaPhone size={20} />} label="Follow-ups Due" value="2" />
          <SummaryCard icon={<FaFileInvoiceDollar size={20} />} label="Total Outstanding" value={`R${totalOutstanding.toLocaleString()}`} />
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={sectionTitle}>Outstanding Accounts</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                Prioritize collections and monitor overdue patient balances.
              </p>
            </div>

            <button style={secondaryButton}>Export Ageing Report</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>Patient</th>
                  <th style={thStyle}>Invoice</th>
                  <th style={thStyle}>Outstanding Amount</th>
                  <th style={thStyle}>Days Outstanding</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {accounts.map((account) => (
                  <tr key={account.invoice}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{account.patient}</div>
                    </td>

                    <td style={tdStyle}>{account.invoice}</td>
                    <td style={tdStyle}>{account.amount}</td>
                    <td style={tdStyle}>{account.days} days</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          padding: "6px 10px",
                          borderRadius: "999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          background:
                            account.days > 45
                              ? "#fee2e2"
                              : account.days > 30
                              ? "#ffedd5"
                              : "#dcfce7",
                          color:
                            account.days > 45
                              ? "#b91c1c"
                              : account.days > 30
                              ? "#c2410c"
                              : "#166534",
                        }}
                      >
                        {account.days > 45 ? "High" : account.days > 30 ? "Medium" : "Low"}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button style={iconButton}>
                          <FaPhone size={12} />
                        </button>
                        <button style={iconButton}>
                          <FaEnvelope size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }) {
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
      <div style={{ fontSize: "30px", fontWeight: 700, color: "#0f172a", marginTop: "6px" }}>
        {value}
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
};

const sectionTitle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "22px",
};

const eyebrowStyle = {
  color: "#64748b",
  fontSize: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "8px",
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

const iconButton = {
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  border: "1px solid #dbe7e4",
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  color: "#334155",
};

const thStyle = {
  textAlign: "left",
  padding: "14px 12px",
  fontSize: "13px",
  fontWeight: 700,
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle = {
  padding: "16px 12px",
  borderBottom: "1px solid #eef2f7",
  color: "#334155",
  fontSize: "14px",
};