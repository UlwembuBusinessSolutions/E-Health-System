import { FaBell, FaSearch } from "react-icons/fa";

export default function TenantTopBar() {
  return (
    <header
      style={{
        height: "72px",
        background: "#ffffff",
        borderBottom: "1px solid #dbe7ef",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#f5f7fb",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "10px 14px",
          width: "340px",
        }}
      >
        <FaSearch color="#64748b" />

        <input
          placeholder="Search patients, visits, appointments..."
          style={{
            border: "none",
            background: "transparent",
            outline: "none",
            width: "100%",
            fontSize: "14px",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <FaBell color="#64748b" size={18} />

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 700, color: "#10233f", fontSize: "14px" }}>
            Mamelodi West Clinic
          </div>

          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Tenant Administrator
          </div>
        </div>
      </div>
    </header>
  );
}