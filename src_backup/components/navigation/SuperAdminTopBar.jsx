import { FaBell, FaSearch } from "react-icons/fa";

export default function SuperAdminTopBar() {
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
          width: "360px",
        }}
      >
        <FaSearch color="#64748b" />

        <input
          placeholder="Search organisations, tenants, clinics..."
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

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#2563eb",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            AU
          </div>

          <div>
            <div style={{ fontWeight: 700, color: "#10233f", fontSize: "14px" }}>
              Amo Ulwembu
            </div>

            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Platform Administrator
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
