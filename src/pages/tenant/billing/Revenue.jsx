import {
  FaMoneyBillWave,
  FaChartLine,
  FaFileInvoiceDollar,
  FaWallet,
} from "react-icons/fa";

const monthlyRevenue = [
  { month: "May", amount: "R98,400" },
  { month: "Jun", amount: "R112,750" },
  { month: "Jul", amount: "R128,200" },
  { month: "Aug", amount: "R134,980" },
];

export default function Revenue() {
  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ marginBottom: "28px" }}>
          <div style={eyebrowStyle}>Billing / Revenue Monitoring</div>
          <h1 style={{ fontSize: "42px", margin: 0, color: "#0f172a" }}>
            Revenue Monitoring
          </h1>
          <p style={{ color: "#64748b", marginTop: "10px", fontSize: "15px" }}>
            Monitor clinic income, collections, payment performance, and monthly revenue trends across consultations, pharmacy, and laboratory services.
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
          <StatCard icon={<FaMoneyBillWave size={20} />} label="Revenue Today" value="R12,450" />
          <StatCard icon={<FaChartLine size={20} />} label="This Month" value="R134,980" />
          <StatCard icon={<FaFileInvoiceDollar size={20} />} label="Invoices Issued" value="214" />
          <StatCard icon={<FaWallet size={20} />} label="Collection Rate" value="92%" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "24px",
          }}
        >
          <div style={cardStyle}>
            <h2 style={sectionTitle}>Monthly Revenue Trend</h2>

            <div style={{ display: "grid", gap: "14px", marginTop: "20px" }}>
              {monthlyRevenue.map((item) => (
                <div
                  key={item.month}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 0",
                    borderBottom: "1px solid #eef2f7",
                  }}
                >
                  <span style={{ fontWeight: 600, color: "#334155" }}>{item.month}</span>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{item.amount}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <h2 style={sectionTitle}>Revenue Breakdown</h2>

              <div style={{ display: "grid", gap: "14px", marginTop: "20px" }}>
                <BreakdownRow label="Consultations" value="R72,500" />
                <BreakdownRow label="Pharmacy Sales" value="R38,200" />
                <BreakdownRow label="Laboratory Services" value="R14,700" />
                <BreakdownRow label="Other Clinical Services" value="R9,580" />
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitle}>Outstanding Summary</h2>

              <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
                <SummaryRow label="Current Outstanding" value="R8,420" />
                <SummaryRow label="Overdue > 30 days" value="R2,150" />
                <SummaryRow label="Medical Aid Pending" value="R5,980" />
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
      <div style={{ fontSize: "30px", fontWeight: 700, color: "#0f172a", marginTop: "6px" }}>
        {value}
      </div>
    </div>
  );
}

function BreakdownRow({ label, value }) {
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

function SummaryRow({ label, value }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 0",
      }}
    >
      <span style={{ color: "#475569", fontSize: "14px" }}>{label}</span>
      <span style={{ fontWeight: 700, color: "#0f172a" }}>{value}</span>
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