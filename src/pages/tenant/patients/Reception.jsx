const queue = [
  {
    number: "Q-001",
    patient: "John Dlamini",
    time: "08:15",
    status: "Waiting",
  },
  {
    number: "Q-002",
    patient: "Sarah Moyo",
    time: "08:27",
    status: "In Consultation",
  },
  {
    number: "Q-003",
    patient: "Nomsa Ncube",
    time: "08:42",
    status: "Waiting",
  },
  {
    number: "Q-004",
    patient: "Thabo Khumalo",
    time: "09:05",
    status: "Completed",
  },
];

const statusStyles = {
  Waiting: {
    background: "#fef3c7",
    color: "#92400e",
  },
  "In Consultation": {
    background: "#dbeafe",
    color: "#1d4ed8",
  },
  Completed: {
    background: "#dcfce7",
    color: "#166534",
  },
};

export default function Reception() {
  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dbe7e4",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, color: "#0f172a", fontSize: "1.9rem" }}>
              Reception & Queue
            </h1>
            <p style={{ color: "#64748b", marginTop: "6px" }}>
              Manage patient arrivals and the clinic waiting queue for Mamelodi West Clinic.
            </p>
          </div>

          <button
            style={{
              background: "#0f766e",
              color: "white",
              border: "none",
              padding: "12px 18px",
              borderRadius: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add Walk-in Patient
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
        }}
      >
        <div style={statCard}>
          <div style={statLabel}>Waiting Patients</div>
          <div style={statValue}>12</div>
        </div>

        <div style={statCard}>
          <div style={statLabel}>In Consultation</div>
          <div style={statValue}>4</div>
        </div>

        <div style={statCard}>
          <div style={statLabel}>Completed Today</div>
          <div style={statValue}>28</div>
        </div>

        <div style={statCard}>
          <div style={statLabel}>Average Wait Time</div>
          <div style={statValue}>18 min</div>
        </div>
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dbe7e4",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0, color: "#0f172a" }}>Today's Queue</h2>
          <span style={{ color: "#64748b", fontSize: "14px" }}>
            {queue.length} patients
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={thStyle}>Queue #</th>
                <th style={thStyle}>Patient</th>
                <th style={thStyle}>Arrival Time</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {queue.map((item) => (
                <tr key={item.number}>
                  <td style={tdStyle}>
                    <strong>{item.number}</strong>
                  </td>
                  <td style={tdStyle}>{item.patient}</td>
                  <td style={tdStyle}>{item.time}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        ...statusStyles[item.status],
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontWeight: 600,
                        fontSize: "12px",
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button style={outlineButton}>Call Next</button>
                      <button style={outlineButton}>Complete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const statCard = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "18px",
  padding: "20px",
  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
};

const statLabel = {
  color: "#64748b",
  fontSize: "14px",
  marginBottom: "8px",
};

const statValue = {
  color: "#0f172a",
  fontSize: "1.8rem",
  fontWeight: 700,
};

const thStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: "13px",
};

const tdStyle = {
  padding: "14px 12px",
  borderBottom: "1px solid #f1f5f9",
  color: "#0f172a",
};

const outlineButton = {
  padding: "8px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 600,
  cursor: "pointer",
};