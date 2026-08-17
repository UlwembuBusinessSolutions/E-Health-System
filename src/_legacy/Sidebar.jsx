import SuperAdminSidebar from "./SuperAdminSidebar";
import TenantSidebar from "./TenantSidebar";
import logo from "../../assets/images/ulwembu-logo.png";

export default function Sidebar({ mode = "super-admin" }) {
  return (
    <aside
      style={{
        width: "292px",
        background: "#ffffff",
        borderRight: "1px solid #dbe7ef",
        height: "100vh",
        position: "sticky",
        top: 0,
        overflowY: "auto",
      }}
    >
      <div style={{ padding: "26px 20px 18px", borderBottom: "1px solid #eef3f7" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img
            src={logo}
            alt="Ulwembu Healthcare Management System"
            style={{ width: "36px", height: "36px", objectFit: "contain" }}
          />

          <div>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#10233f" }}>
              Ulwembu Healthcare
            </div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>
              Management System
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 10px 28px" }}>
        {mode === "tenant" ? <TenantSidebar /> : <SuperAdminSidebar />}
      </div>
    </aside>
  );
}