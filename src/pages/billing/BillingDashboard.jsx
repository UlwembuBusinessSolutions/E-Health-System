import {
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaCreditCard,
  FaReceipt,
  FaPlus,
} from "react-icons/fa";

const invoices = [
  { id: "INV-2026-001", patient: "Nomsa Dlamini", amount: "R450", status: "Paid" },
  { id: "INV-2026-002", patient: "Thabo Mokoena", amount: "R320", status: "Pending" },
  { id: "INV-2026-003", patient: "Lerato Nkosi", amount: "R780", status: "Medical Aid" },
];

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
};

export default function BillingDashboard() {
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
              Billing & Payments
            </div>

            <h1 style={{ fontSize: "44px", margin: 0, color: "#0f172a" }}>
              Billing Dashboard
            </h1>

            <p style={{ color: "#64748b", fontSize: "16px", marginTop: "12px" }}>
              Manage invoices, payments, receipts, and medical aid claims for patient visits and pharmacy services.
            </p>
          </div>

          <button style={primaryButton}>
            <FaPlus size={12} />
            Create Invoice
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
          <StatCard icon={<FaFileInvoiceDollar size={20} />} label="Invoices Today" value="18" />
          <StatCard icon={<FaMoneyBillWave size={20} />} label="Revenue Collected" value="R12,450" />
          <StatCard icon={<FaCreditCard size={20} />} label="Outstanding Payments" value="R3,280" />
          <StatCard icon={<FaReceipt size={20} />} label="Receipts Issued" value="15" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "24px",
          }}
        >
          <div style={cardStyle}>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ margin: 0, color: "#0f172a" }}>Recent Invoices</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                Latest billing activity for patient consultations and pharmacy transactions.
              </p>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
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
                  <div>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{invoice.id}</div>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>{invoice.patient}</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{invoice.amount}</div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color:
                          invoice.status === "Paid"
                            ? "#15803d"
                            : invoice.status === "Pending"
                            ? "#ea580c"
                            : "#2563eb",
                      }}
                    >
                      {invoice.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Quick Billing Actions</h2>

              <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
                <button style={actionButton}>Create Consultation Invoice</button>
                <button style={actionButton}>Record Payment</button>
                <button style={actionButton}>Generate Receipt</button>
                <button style={actionButton}>Submit Medical Aid Claim</button>
                <button style={actionButton}>View Outstanding Accounts</button>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Payment Methods Today</h2>

              <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
                <PaymentRow label="Cash" value="R4,200" />
                <PaymentRow label="Card" value="R5,850" />
                <PaymentRow label="EFT" value="R1,900" />
                <PaymentRow label="Medical Aid" value="R500" />
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

function PaymentRow({ label, value }) {
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
      <span style={{ color: "#475569", fontSize: "14px" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#0f172a" }}>{value}</span>
    </div>
  );
}

const primaryButton = {
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
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