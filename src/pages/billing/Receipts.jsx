const receipts = [
  { number: "RCPT-001", patient: "Nomsa Dlamini", amount: "R450", date: "2026-08-12" },
  { number: "RCPT-002", patient: "Sipho Khumalo", amount: "R320", date: "2026-08-12" },
  { number: "RCPT-003", patient: "Ayanda Maseko", amount: "R780", date: "2026-08-11" },
];

export default function Receipts() {
  return (
    <div style={{ padding: "32px" }}>
      <h1>Receipt Tracking</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th style={th}>Receipt No.</th>
            <th style={th}>Patient</th>
            <th style={th}>Amount</th>
            <th style={th}>Date</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((receipt) => (
            <tr key={receipt.number}>
              <td style={td}>{receipt.number}</td>
              <td style={td}>{receipt.patient}</td>
              <td style={td}>{receipt.amount}</td>
              <td style={td}>{receipt.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { textAlign: "left", padding: "12px", borderBottom: "1px solid #cbd5e1" };
const td = { padding: "12px", borderBottom: "1px solid #e2e8f0" };