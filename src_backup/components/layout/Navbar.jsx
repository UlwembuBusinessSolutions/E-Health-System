export default function Navbar() {
  return (
    <header
      style={{
        height: "76px",
        background: "rgba(255,255,255,0.9)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid var(--line)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ flex: 1, maxWidth: "520px" }}>
        <input
          type="text"
          placeholder="Search patients, visits, staff..."
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: "14px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            fontSize: "14px",
            color: "var(--text)",
            outline: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "14px" }}>
            Mamelodi Health Services
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Tenant Administrator
          </div>
        </div>

        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "var(--accent)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
          }}
        >
          AE
        </div>
      </div>
    </header>
  );
}