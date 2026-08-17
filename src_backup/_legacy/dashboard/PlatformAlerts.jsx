import SectionCard from "../common/SectionCard";

const alerts = [
  "2 organisations require branding review",
  "Audit export retry scheduled for tonight",
  "Pharmacy inventory sync completed successfully",
];

export default function PlatformAlerts() {
  return (
    <SectionCard
      title="Platform Alerts"
      subtitle="Items that may require administrative attention."
    >
      <div style={{ display: "grid", gap: "12px" }}>
        {alerts.map((alert) => (
          <div
            key={alert}
            style={{
              padding: "12px 14px",
              borderRadius: "14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              fontSize: "13px",
              color: "#334155",
            }}
          >
            {alert}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}