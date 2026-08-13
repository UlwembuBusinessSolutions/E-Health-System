import { NavLink } from "react-router-dom";
import {
  FaHome,
  FaBuilding,
  FaUsers,
  FaPalette,
  FaUserPlus,
  FaClipboardList,
  FaCalendarCheck,
  FaStethoscope,
  FaPills,
  FaChartBar,
  FaCog,
  FaShieldAlt,
  FaGraduationCap,
  FaPlus,
  FaCapsules,
  FaBoxes,
  FaFilePrescription,
  FaClock,
  FaFileInvoiceDollar,
  FaMoneyBillWave,
  FaReceipt,
} from "react-icons/fa";

import logo from "../../assets/images/ulwembu-logo.png";

const navItemStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "10px 12px",
  borderRadius: "12px",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: isActive ? 600 : 500,
  background: isActive ? "#0f766e" : "transparent",
  color: isActive ? "#ffffff" : "#334155",
  transition: "all 0.2s ease",
});

const sectionTitleStyle = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#94a3b8",
  margin: "18px 0 10px",
};

const quickActionStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid #dbe7e4",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
};

function SidebarSection({ title, children }) {
  return (
    <div>
      <div style={sectionTitleStyle}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {children}
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside
      style={{
        width: "320px",
        background: "#ffffff",
        borderRight: "1px solid #dbe7e4",
        minHeight: "100vh",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        boxSizing: "border-box",
        overflowY: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <img
          src={logo}
          alt="Ulwembu Healthcare Management System logo"
          style={{ width: "48px", height: "48px", objectFit: "contain" }}
        />
        <div>
          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "15px" }}>
            Ulwembu Healthcare
          </div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Management System
          </div>
        </div>
      </div>

      {/* Facility Card */}
      <div
        style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "16px",
          display: "grid",
          gap: "6px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "#0f766e",
            textTransform: "uppercase",
          }}
        >
          Organisation / Facility
        </div>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>
          Mamelodi Health Services
        </div>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Mamelodi West Clinic · Tenant Admin
        </div>
      </div>

      {/* Platform */}
      <SidebarSection title="Platform">
        <NavLink to="/" style={navItemStyle} end>
          <FaHome size={16} />
          <span>Super Admin Console</span>
        </NavLink>

        <NavLink to="/organisations" style={navItemStyle}>
          <FaBuilding size={16} />
          <span>Organisations</span>
        </NavLink>
      </SidebarSection>

      {/* Tenant Administration */}
      <SidebarSection title="Tenant Administration">
        <NavLink to="/tenant/staff" style={navItemStyle}>
          <FaUsers size={16} />
          <span>Staff & Users</span>
        </NavLink>

        <NavLink to="/branding" style={navItemStyle}>
          <FaPalette size={16} />
          <span>Organisation Branding</span>
        </NavLink>
      </SidebarSection>

      {/* Overview */}
      <SidebarSection title="Overview">
        <NavLink to="/" style={navItemStyle}>
          <FaHome size={16} />
          <span>Dashboard</span>
        </NavLink>
      </SidebarSection>

     {/* Patient Management */}
<SidebarSection title="Patient Management">
  <NavLink to="/patients" style={navItemStyle}>
    <FaUserPlus size={16} />
    <span>Patient Registration</span>
  </NavLink>

  <NavLink to="/reception" style={navItemStyle}>
    <FaClipboardList size={16} />
    <span>Reception & Queue</span>
  </NavLink>

  <NavLink to="/reception/board" style={navItemStyle}>
    <FaClock size={16} />
    <span>Queue Board</span>
  </NavLink>

  <NavLink to="/appointments" style={navItemStyle}>
    <FaCalendarCheck size={16} />
    <span>Appointments</span>
  </NavLink>
</SidebarSection>

      {/* Clinical */}
      <SidebarSection title="Clinical Services">
        <NavLink to="/clinical" style={navItemStyle}>
          <FaStethoscope size={16} />
          <span>Clinical Services</span>
        </NavLink>
      </SidebarSection>

      {/* Pharmacy */}
      <SidebarSection title="Pharmacy">
        <NavLink to="/pharmacy" style={navItemStyle}>
          <FaPills size={16} />
          <span>Pharmacy Dashboard</span>
        </NavLink>

        <NavLink to="/pharmacy/dispensing" style={navItemStyle}>
          <FaFilePrescription size={16} />
          <span>Prescription Dispensing</span>
        </NavLink>

        <NavLink to="/pharmacy/inventory" style={navItemStyle}>
          <FaBoxes size={16} />
          <span>Medication Inventory</span>
        </NavLink>

        <NavLink to="/pharmacy/stock" style={navItemStyle}>
          <FaCapsules size={16} />
          <span>Stock Management</span>
        </NavLink>
      </SidebarSection>

       {/* Billing */}
      <SidebarSection title="Billing">
  <NavLink to="/billing" style={navItemStyle}>
    <FaFileInvoiceDollar size={16} />
    <span>Billing Dashboard</span>
  </NavLink>

  <NavLink to="/billing/invoices" style={navItemStyle}>
    <FaFileInvoiceDollar size={16} />
    <span>Invoice Generation</span>
  </NavLink>

  <NavLink to="/billing/payments" style={navItemStyle}>
    <FaMoneyBillWave size={16} />
    <span>Payments</span>
  </NavLink>

  <NavLink to="/billing/receipts" style={navItemStyle}>
    <FaReceipt size={16} />
    <span>Receipts</span>
  </NavLink>

  <NavLink to="/billing/claims" style={navItemStyle}>
    <FaShieldAlt size={16} />
    <span>Medical Aid Claims</span>
  </NavLink>

  <NavLink to="/billing/revenue" style={navItemStyle}>
    <FaChartBar size={16} />
    <span>Revenue Monitoring</span>
  </NavLink>

  <NavLink to="/billing/outstanding" style={navItemStyle}>
    <FaClipboardList size={16} />
    <span>Outstanding Accounts</span>
  </NavLink>
</SidebarSection>

      {/* Management */}
      <SidebarSection title="Management">
        <NavLink to="/reports" style={navItemStyle}>
          <FaChartBar size={16} />
          <span>Reports</span>
        </NavLink>

        <NavLink to="/administration" style={navItemStyle}>
          <FaCog size={16} />
          <span>Administration</span>
        </NavLink>

        <NavLink to="/audit" style={navItemStyle}>
          <FaShieldAlt size={16} />
          <span>Audit & Compliance</span>
        </NavLink>

        <NavLink to="/training" style={navItemStyle}>
          <FaGraduationCap size={16} />
          <span>Training</span>
        </NavLink>
      </SidebarSection>

      {/* Quick Actions */}
      <div
        style={{
          marginTop: "8px",
          paddingTop: "18px",
          borderTop: "1px solid #e2e8f0",
          display: "grid",
          gap: "10px",
        }}
      >
        <div style={sectionTitleStyle}>Quick Actions</div>

        <button style={quickActionStyle}>
          <FaPlus size={14} />
          Register Patient
        </button>

        <button style={quickActionStyle}>
          <FaPlus size={14} />
          New Visit
        </button>

        <button style={quickActionStyle}>
          <FaPlus size={14} />
          Issue Prescription
        </button>
      </div>

      {/* User */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "18px",
          borderTop: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            background: "#0f766e",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
          }}
        >
          AA
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, color: "#0f172a", fontSize: "14px" }}>
            Amo Admin
          </div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Tenant Administrator
          </div>
        </div>
      </div>
    </aside>
  );
}