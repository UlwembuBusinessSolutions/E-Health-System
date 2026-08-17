import { NavLink } from "react-router-dom";
import {
  FaChartPie,
  FaUserPlus,
  FaClipboardList,
  FaClock,
  FaCalendarCheck,
  FaStethoscope,
  FaPills,
  FaFileInvoiceDollar,
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
  color: isActive ? "#0f766e" : "#10233f",
  background: isActive ? "#dff4f2" : "transparent",
} );

const sectionTitle = {
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#7b8da6",
  margin: "22px 0 10px",
};

export default function TenantSidebar() {
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
        <div style={{ fontWeight: 800, fontSize: "18px", color: "#10233f" }}>
          Mamelodi Health Services
        </div>

        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Clinic Operations Portal
        </div>
      </div>

      <div style={sectionTitle}>Operations</div>

      <NavLink to="/tenant/dashboard" style={linkStyle}>
        <FaChartPie /> Dashboard
      </NavLink>

      <NavLink to="/tenant/patients" style={linkStyle}>
        <FaUserPlus /> Patient Registration
      </NavLink>

      <NavLink to="/tenant/reception" style={linkStyle}>
        <FaClipboardList /> Reception & Queue
      </NavLink>

      <NavLink to="/tenant/reception/board" style={linkStyle}>
        <FaClock /> Queue Board
      </NavLink>

      <NavLink to="/tenant/appointments" style={linkStyle}>
        <FaCalendarCheck /> Appointments
      </NavLink>

      <div style={sectionTitle}>Clinical</div>

      <NavLink to="/tenant/clinical" style={linkStyle}>
        <FaStethoscope /> Clinical Services
      </NavLink>

      <NavLink to="/tenant/pharmacy" style={linkStyle}>
        <FaPills /> Pharmacy
      </NavLink>

      <div style={sectionTitle}>Finance & Admin</div>

      <NavLink to="/tenant/billing" style={linkStyle}>
        <FaFileInvoiceDollar /> Billing
      </NavLink>

      <NavLink to="/tenant/reports" style={linkStyle}>
        <FaChartBar /> Reports
      </NavLink>

      <NavLink to="/tenant/administration" style={linkStyle}>
        <FaCog /> Administration
      </NavLink>
    </aside>
  );
}