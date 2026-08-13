import StatCard from "../common/StatCard";

export default function MetricsGrid() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "18px",
      }}
    >
      <StatCard label="Organisations" value="18" trend="3 pending setup" />
      <StatCard label="Active tenants" value="16" trend="2 suspended" />
      <StatCard label="Clinics" value="74" trend="Across all tenants" />
      <StatCard label="Platform alerts" value="4" trend="Requires review" />
    </div>
  );
}