export default function Reports() {
  const cards = [
    { title: "Patients Registered", value: 1248 },
    { title: "Visits Today", value: 86 },
    { title: "Prescriptions Issued", value: 142 },
    { title: "Appointments This Week", value: 318 },
  ];

  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dbe7e4",
          borderRadius: "24px",
          padding: "32px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              color: "#64748b",
              fontSize: "14px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            Management
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "48px",
              color: "#0f172a",
              lineHeight: 1.1,
            }}
          >
            Reports Dashboard
          </h1>

          <p
            style={{
              marginTop: "12px",
              color: "#64748b",
              fontSize: "18px",
            }}
          >
            Monitor operational performance, patient activity, and service delivery across the clinic.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {cards.map((card) => (
            <div
              key={card.title}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                padding: "24px",
                textAlign: "center",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "10px" }}>
                {card.title}
              </div>
              <div style={{ fontSize: "36px", fontWeight: 700, color: "#0f172a" }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: "24px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #dbe7e4",
              borderRadius: "20px",
              padding: "24px",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#0f172a" }}>Monthly Activity</h2>
            <p style={{ color: "#64748b", marginBottom: "20px" }}>
              Overview of patient and pharmacy activity for the current reporting period.
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={thStyle}>Metric</th>
                  <th style={thStyle}>Current Month</th>
                  <th style={thStyle}>Previous Month</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle}>Patient Registrations</td>
                  <td style={tdStyle}>1,248</td>
                  <td style={tdStyle}>1,102</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Clinical Consultations</td>
                  <td style={tdStyle}>3,864</td>
                  <td style={tdStyle}>3,721</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Prescriptions Dispensed</td>
                  <td style={tdStyle}>2,476</td>
                  <td style={tdStyle}>2,301</td>
                </tr>
                <tr>
                  <td style={tdStyle}>Missed Appointments</td>
                  <td style={tdStyle}>54</td>
                  <td style={tdStyle}>61</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #dbe7e4",
              borderRadius: "20px",
              padding: "24px",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#0f172a" }}>Quick Exports</h2>
            <p style={{ color: "#64748b", marginBottom: "20px" }}>
              Generate common operational reports for management review.
            </p>

            <div style={{ display: "grid", gap: "12px" }}>
              <button style={buttonStyle}>Export Patient Register</button>
              <button style={buttonStyle}>Export Appointment Summary</button>
              <button style={buttonStyle}>Export Pharmacy Stock Report</button>
              <button style={buttonStyle}>Export Clinical Activity Report</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "13px",
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle = {
  padding: "16px",
  borderBottom: "1px solid #eef2f7",
  color: "#0f172a",
};

const buttonStyle = {
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
};