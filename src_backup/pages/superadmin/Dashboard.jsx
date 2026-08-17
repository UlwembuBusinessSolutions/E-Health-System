export default function Dashboard() {
  const cards = [
    {
      title: "Organisations",
      value: "18",
      subtitle: "Active healthcare organisations",
    },
    {
      title: "Active Tenants",
      value: "16",
      subtitle: "Provisioned operational tenants",
    },
    {
      title: "Connected Clinics",
      value: "74",
      subtitle: "Clinics connected to the platform",
    },
    {
      title: "Platform Alerts",
      value: "4",
      subtitle: "Compliance and operational alerts",
    },
  ];

  return (
    <div style={{ display: "grid", gap: "28px" }}>
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "34px",
            fontWeight: 800,
            color: "#10233f",
          }}
        >
          Platform Dashboard
        </h1>

        <p style={{ marginTop: "10px", color: "#64748b" }}>
          Enterprise overview of organisations, tenants, clinics, compliance,
          and platform operations.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
        }}
      >
        {cards.map((card) => (
          <div
            key={card.title}
            style={{
              background: "#ffffff",
              border: "1px solid #dbe7ef",
              borderRadius: "24px",
              padding: "24px",
            }}
          >
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              {card.title}
            </div>

            <div
              style={{
                marginTop: "12px",
                fontSize: "36px",
                fontWeight: 800,
                color: "#10233f",
              }}
            >
              {card.value}
            </div>

            <div
              style={{
                marginTop: "10px",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              {card.subtitle}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
