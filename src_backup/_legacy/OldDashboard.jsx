const cards = [
  { title: "Organisations", value: "18", subtitle: "3 pending setup" },
  { title: "Active tenants", value: "16", subtitle: "2 suspended" },
  { title: "Clinics", value: "74", subtitle: "Across all tenants" },
  { title: "Platform alerts", value: "4", subtitle: "Requires review" },
]

export default function Dashboard() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "inline-block",
            background: "#ccfbf1",
            color: "#115e59",
            padding: "6px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 12,
          }}
        >
          Super Admin context
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: "2rem", color: "#0f172a" }}>
          Super Admin Console
        </h1>

        <p style={{ margin: 0, color: "#64748b" }}>
          Platform-level administration for Ulwembu organisations and tenants.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          marginBottom: 28,
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              background: "#ffffff",
              borderRadius: 18,
              padding: 24,
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={{ color: "#64748b", fontWeight: 600, marginBottom: 14 }}>
              {card.title}
            </div>

            <div style={{ fontSize: "2rem", fontWeight: 800, color: "#0f172a" }}>
              {card.value}
            </div>

            <div style={{ color: "#64748b", marginTop: 8, fontSize: 14 }}>
              {card.subtitle}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 24,
        }}
      >
        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            border: "1px solid #e2e8f0",
            padding: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <h3 style={{ margin: 0, color: "#0f172a" }}>Recent organisations</h3>

            <button
              style={{
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: 10,
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              View all
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={th}>Organisation</th>
                <th style={th}>Sector</th>
                <th style={th}>Status</th>
              </tr>
            </thead>

            <tbody>
              <Row org="Mamelodi Health Services" sector="Private" status="Active" />
              <Row org="Tshwane Occupational Health" sector="Occupational" status="Active" />
              <Row org="Ubuntu Community Clinics" sector="Public" status="Setup pending" />
              <Row org="MediCore Group" sector="Private" status="Suspended" />
            </tbody>
          </table>
        </div>

        <div
          style={{
            background: "#ffffff",
            borderRadius: 20,
            border: "1px solid #e2e8f0",
            padding: 24,
          }}
        >
          <h3 style={{ marginTop: 0, color: "#0f172a" }}>Platform activity</h3>

          <Activity title="Organisation created" detail="Mamelodi Health Services · 18 minutes ago" />
          <Activity title="Tenant branding updated" detail="Ubuntu Community Clinics · 1 hour ago" />
          <Activity title="Clinic limit changed" detail="MediCore Group · 2 hours ago" />
        </div>
      </div>
    </div>
  )
}

function Row({ org, sector, status }) {
  return (
    <tr>
      <td style={td}><strong>{org}</strong></td>
      <td style={td}>{sector}</td>
      <td style={td}>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            background: status === "Active" ? "#dcfce7" : status === "Suspended" ? "#fee2e2" : "#fef3c7",
            color: status === "Active" ? "#166534" : status === "Suspended" ? "#991b1b" : "#92400e",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          {status}
        </span>
      </td>
    </tr>
  )
}

function Activity({ title, detail }) {
  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <div style={{ fontWeight: 600, color: "#0f172a" }}>{title}</div>
      <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>{detail}</div>
    </div>
  )
}

const th = {
  textAlign: "left",
  padding: "12px 16px",
  color: "#475569",
  fontSize: 14,
  fontWeight: 700,
}

const td = {
  padding: "14px 16px",
  borderTop: "1px solid #e2e8f0",
  color: "#0f172a",
}