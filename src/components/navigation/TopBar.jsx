export default function TopBar() {
  return (
    <header
      style={{
        height: "72px",
        background: "#ffffff",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        boxSizing: "border-box",
      }}
    >
      {/* Search */} 
      <input
        type="text"
        placeholder="Search tenants, clinics, users or modules"
        style={{
          width: "420px",
          padding: "12px 16px",
          borderRadius: "14px",
          border: "1px solid #cbd5e1",
          background: "#f8fafc",
          fontSize: "14px",
          outline: "none",
        }}
      />

      {/* User section */} 
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: "#e2e8f0",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            color: "#0f172a",
          }}
        >
          EU
        </div>

        <div style={{ lineHeight: 1.2 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "14px",
              color: "#0f172a",
            }}
          >
            Emilio Ulwembu
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "#64748b",
            }}
          >
            Super Admin
          </div>
        </div>

        <button
          style={{
            padding: "10px 16px",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
