const claims = [
  { claim: "CLM-1001", patient: "Nomsa Dlamini", scheme: "Discovery Health", amount: "R450", status: "Submitted" },
  { claim: "CLM-1002", patient: "Lerato Nkosi", scheme: "Bonitas", amount: "R780", status: "Approved" },
  { claim: "CLM-1003", patient: "Sipho Khumalo", scheme: "Momentum Health", amount: "R320", status: "Rejected" },
];

export default function MedicalAidClaims() {
  return (
    <div style={{ padding: "32px" }}>
      <h1>Medical Aid / Insurance Claims</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            <th style={th}>Claim No.</th>
            <th style={th}>Patient</th>
            <th style={th}>Scheme</th>
            <th style={th}>Amount</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.claim}>
              <td style={td}>{claim.claim}</td>
              <td style={td}>{claim.patient}</td>
              <td style={td}>{claim.scheme}</td>
              <td style={td}>{claim.amount}</td>
              <td style={td}>{claim.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th = { textAlign: "left", padding: "12px", borderBottom: "1px solid #cbd5e1" };
const td = { padding: "12px", borderBottom: "1px solid #e2e8f0" };