import PageHeader from "../../components/common/PageHeader";
import StatCard from "../../components/common/StatCard";

export default function Dashboard() {
  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <PageHeader
        title="Super Admin Console"
        subtitle="Monitor organisations, facilities, tenants, and platform activity."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        <StatCard label="Organisations" value="18" trend="+3 this month" />
        <StatCard label="Active Tenants" value="16" trend="99.8% uptime" />
        <StatCard label="Clinics Connected" value="74" trend="+8 onboarded" />
        <StatCard label="Platform Alerts" value="4" trend="2 require review" />
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "var(--shadow)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "20px" }}>
          Platform Activity
        </h2>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                textAlign: "left",
                color: "var(--muted)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <th style={{ padding: "12px 0" }}>Organisation</th>
              <th style={{ padding: "12px 0" }}>Status</th>
              <th style={{ padding: "12px 0" }}>Last Activity</th>
            </tr>
          </thead>

          <tbody>
            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "14px 0" }}>Mamelodi Health Services</td>
              <td style={{ padding: "14px 0" }}>Active</td>
              <td style={{ padding: "14px 0" }}>2 minutes ago</td>
            </tr>

            <tr style={{ borderBottom: "1px solid var(--line)" }}>
              <td style={{ padding: "14px 0" }}>Ulwembu Community Clinics</td>
              <td style={{ padding: "14px 0" }}>Active</td>
              <td style={{ padding: "14px 0" }}>14 minutes ago</td>
            </tr>

            <tr>
              <td style={{ padding: "14px 0" }}>Pretoria Primary Care Network</td>
              <td style={{ padding: "14px 0" }}>Pending Review</td>
              <td style={{ padding: "14px 0" }}>1 hour ago</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
