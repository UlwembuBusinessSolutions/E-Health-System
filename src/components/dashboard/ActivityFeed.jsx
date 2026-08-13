import SectionCard from "../common/SectionCard";

const activities = [
  {
    title: "Mamelodi Health Services onboarded a new clinic",
    time: "2 minutes ago",
  },
  {
    title: "Tenant administrator password reset completed",
    time: "14 minutes ago",
  },
  {
    title: "Pretoria Primary Care Network pending review",
    time: "1 hour ago",
  },
];

export default function ActivityFeed() {
  return (
    <SectionCard
      title="Recent Platform Activity"
      subtitle="Live operational events across organisations and tenants."
    >
      <div style={{ display: "grid", gap: "16px" }}>
        {activities.map((item) => (
          <div
            key={item.title}
            style={{
              paddingBottom: "14px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <div style={{ fontWeight: 600, color: "#0f172a" }}>
              {item.title}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              {item.time}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}