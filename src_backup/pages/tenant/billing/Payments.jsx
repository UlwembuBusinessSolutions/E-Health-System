const payments = [
  { invoice: "INV-2026-001", patient: "Nomsa Dlamini", method: "Card", amount: "R450", status: "Paid" },
  { invoice: "INV-2026-002", patient: "Thabo Mokoena", method: "Cash", amount: "R320", status: "Pending" },
  { invoice: "INV-2026-003", patient: "Lerato Nkosi", method: "EFT", amount: "R780", status: "Processing" },
];

export default function Payments() {
  return (
    <div style={{ padding: "32px" }}>
      <h1>Payments</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th style={th}>Invoice</th>
            <th style={th}>Patient</th>
            <th style={th}>Method</th>
            <th style={th}>Amount</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.invoice}>
              <td style={td}>{payment.invoice}</td>
              <td style={td}>{payment.patient}</td>
              <td style={td}>{payment.method}</td>
              <td style={td}>{payment.amount}</td>
              <td style={td}>{payment.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { textAlign: "left", padding: "12px", borderBottom: "1px solid #cbd5e1" };
const td = { padding: "12px", borderBottom: "1px solid #e2e8f0" };