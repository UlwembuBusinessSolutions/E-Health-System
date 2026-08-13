import PageHeader from "../../components/common/PageHeader";
import MetricsGrid from "../../components/dashboard/MetricsGrid";
import ActivityFeed from "../../components/dashboard/ActivityFeed";
import PlatformAlerts from "../../components/dashboard/PlatformAlerts";
import SectionCard from "../../components/common/SectionCard";

export default function Dashboard() {
  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <PageHeader
        title="Super Admin Console"
        subtitle="Platform-level administration for Ulwembu organisations, facilities, and tenants."
      />

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 14px",
          borderRadius: "999px",
          background: "#ccfbf1",
          color: "#0f766e",
          fontSize: "13px",
          fontWeight: 600,
          width: "fit-content",
        }}
      >
        Super Admin context
      </div>

      <MetricsGrid />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
        }}
      >
        <ActivityFeed />
        <PlatformAlerts />
      </div>

      <SectionCard
        title="Organisation Overview"
        subtitle="Current tenant status across the connected healthcare network."
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
              <th style={{ padding: "12px 0" }}>Organisation</th>
              <th style={{ padding: "12px 0" }}>Status</th>
              <th style={{ padding: "12px 0" }}>Last Activity</th>
            </tr>
          </thead>

          <tbody>
            <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "14px 0", fontWeight: 600 }}>
                Mamelodi Health Services
              </td>
              <td style={{ padding: "14px 0" }}>Active</td>
              <td style={{ padding: "14px 0" }}>2 minutes ago</td>
            </tr>

            <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "14px 0", fontWeight: 600 }}>
                Ulwembu Community Clinics
              </td>
              <td style={{ padding: "14px 0" }}>Active</td>
              <td style={{ padding: "14px 0" }}>14 minutes ago</td>
            </tr>

            <tr>
              <td style={{ padding: "14px 0", fontWeight: 600 }}>
                Pretoria Primary Care Network
              </td>
              <td style={{ padding: "14px 0" }}>Pending Review</td>
              <td style={{ padding: "14px 0" }}>1 hour ago</td>
            </tr>
          </tbody>
        </table>
      </SectionCard>
    </div>
  );
}