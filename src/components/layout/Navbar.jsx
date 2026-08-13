export default function Navbar() {
  return (
    <header
      style={{
        height: 76,
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
          ORGANISATION / FACILITY
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
          Mamelodi West Clinic · Tenant Admin
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "#0f766e",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
          }}
        >
          AA
        </div>

        <div>
          <div style={{ fontWeight: 600, color: "#0f172a" }}>Amo Admin</div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Tenant Administrator
          </div>
        </div>
      </div>
    </header>
  );
}