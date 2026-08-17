import { useState } from "react";
import { FaPlus, FaSearch, FaUsersCog } from "react-icons/fa";

const initialTenants = [
  {
    id: "TEN-001",
    organisation: "Mamelodi Health Services",
    admin: "Amo Admin",
    plan: "Enterprise",
    clinics: 12,
    status: "Active",
  },
  {
    id: "TEN-002",
    organisation: "Ulwembu Community Clinics",
    admin: "Lerato Molefe",
    plan: "Professional",
    clinics: 7,
    status: "Active",
  },
  {
    id: "TEN-003",
    organisation: "Pretoria Primary Care Network",
    admin: "Thabo Mokoena",
    plan: "Enterprise",
    clinics: 19,
    status: "Pending Setup",
  },
];

export default function TenantAdministration() {
  const [search, setSearch] = useState("");
  const [tenants, setTenants] = useState(initialTenants);

  const filtered = tenants.filter((tenant) =>
    tenant.organisation.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateTenant = () => {
    const next = {
      id: `TEN-${String(tenants.length + 1).padStart(3, "0")}`,
      organisation: `New Tenant ${tenants.length + 1}`,
      admin: "Pending Assignment",
      plan: "Standard",
      clinics: 1,
      status: "Pending Setup",
    };

    setTenants((prev) => [next, ...prev]);
  };

  return (
    <div style={{ display: "grid", gap: "28px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 800,
              color: "#10233f",
            }}
          >
            Tenant Administration
          </h1>

          <p style={{ marginTop: "10px", color: "#64748b" }}>
            Provision and manage operational healthcare tenants across the Ulwembu platform.
          </p>
        </div>

        <button
          onClick={handleCreateTenant}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "14px",
            padding: "12px 18px",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 10px 24px rgba(37,99,235,0.22)",
          }}
        >
          <FaPlus />
          Create Tenant
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        <Metric label="Total Tenants" value={tenants.length} />
        <Metric label="Active" value="16" />
        <Metric label="Pending Setup" value="3" />
        <Metric label="Connected Clinics" value="74" />
      </div>

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dbe7ef",
          borderRadius: "24px",
          padding: "24px",
          boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
          display: "grid",
          gap: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, color: "#10233f" }}>Tenant Directory</h2>
            <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "13px" }}>
              Manage tenant administrators, subscription plans, and operational status.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "#f8fbfd",
              border: "1px solid #dbe7ef",
              borderRadius: "14px",
              padding: "10px 14px",
              minWidth: "280px",
            }}
          >
            <FaSearch color="#64748b" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants..."
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                width: "100%",
                fontSize: "14px",
              }}
            />
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#64748b" }}>
              <th style={{ paddingBottom: "14px" }}>Tenant</th>
              <th style={{ paddingBottom: "14px" }}>Administrator</th>
              <th style={{ paddingBottom: "14px" }}>Plan</th>
              <th style={{ paddingBottom: "14px" }}>Clinics</th>
              <th style={{ paddingBottom: "14px" }}>Status</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((tenant) => (
              <tr key={tenant.id} style={{ borderTop: "1px solid #eef3f7" }}>
                <td style={{ padding: "18px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "12px",
                        background: "#e8f1ff",
                        color: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FaUsersCog />
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, color: "#10233f" }}>
                        {tenant.organisation}
                      </div>

                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        {tenant.id}
                      </div>
                    </div>
                  </div>
                </td>

                <td style={{ padding: "18px 0", color: "#10233f" }}>
                  {tenant.admin}
                </td>

                <td style={{ padding: "18px 0", color: "#10233f" }}>
                  {tenant.plan}
                </td>

                <td style={{ padding: "18px 0", color: "#10233f", fontWeight: 600 }}>
                  {tenant.clinics}
                </td>

                <td style={{ padding: "18px 0" }}>
                  <StatusBadge status={tenant.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dbe7ef",
        borderRadius: "20px",
        padding: "22px",
        boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ fontSize: "13px", color: "#64748b" }}>{label}</div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "32px",
          fontWeight: 800,
          color: "#10233f",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Active: {
      background: "#dcfce7",
      color: "#166534",
    },
    "Pending Setup": {
      background: "#fef3c7",
      color: "#92400e",
    },
    Suspended: {
      background: "#fee2e2",
      color: "#991b1b",
    },
  };

  const style = styles[status] || styles.Active;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 700,
        background: style.background,
        color: style.color,
      }}
    >
      {status}
    </span>
  );
}
