export default function StatCard({ label, value, trend }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "18px",
        padding: "20px",
        boxShadow: "var(--shadow)",
      }}
    >
      <div style={{ fontSize: "13px", color: "var(--muted)" }}>{label}</div>

      <div
        style={{
          fontSize: "2rem",
          fontWeight: 700,
          margin: "8px 0",
          color: "var(--ink)",
        }}
      >
        {value}
      </div>

      {trend && (
        <div style={{ fontSize: "13px", color: "var(--accent)" }}>
          {trend}
        </div>
      )}
    </div>
  );
}