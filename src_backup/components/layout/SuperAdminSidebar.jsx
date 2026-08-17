import { NavLink } from "react-router-dom";
import {
  FaChartPie,
  FaBuilding,
  FaUsersCog,
  FaShieldAlt,
  FaChartBar,
  FaCog,
} from "react-icons/fa";

const linkStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  borderRadius: "14px",
  textDecoration: "none",
  fontWeight: isActive ? 700 : 500,
  fontSize: "14px",
  color: isActive ? "#2563eb" : "#10233f",
  background: isActive ? "#e8f1ff" : "transparent",
});

const sectionTitle = {
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#7b8da6",
  margin: "22px 0 10px",
};

export default function SuperAdminSidebar() {
  return (
    <aside
      style={{
        width: "292px",
        background: "#ffffff",
        borderRight: "1px solid #dbe7ef",
        padding: "22px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: "20px",
            color: "#10233f",
          }}
        >
          Ulwembu
        </div>

        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Healthcare Platform
        </div>
      </div>

      <div style={sectionTitle}>Platform</div>

      <NavLink to="/platform/dashboard" style={linkStyle}>
        <FaChartPie /> Platform Dashboard
      </NavLink>

      <NavLink to="/platform/organisations" style={linkStyle}>
        <FaBuilding /> Organisations
      </NavLink>

      <NavLink to="/platform/tenant/staff" style={linkStyle}>
        <FaUsersCog /> Tenant Administration
      </NavLink>

      <div style={sectionTitle}>Governance</div>

      <NavLink to="/platform/audit" style={linkStyle}>
        <FaShieldAlt /> Audit & Compliance
      </NavLink>

      <NavLink to="/platform/reports" style={linkStyle}>
        <FaChartBar /> Platform Reports
      </NavLink>

      <NavLink to="/platform/settings" style={linkStyle}>
        <FaCog /> Platform Settings
      </NavLink>
    </aside>
  );
}
