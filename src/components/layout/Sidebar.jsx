import { NavLink, useNavigate } from "react-router-dom";
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
  FaUserInjured,
  FaIdCard,
} from "react-icons/fa";

import logo from "../../assets/images/ulwembu-logo.png";

const navItemStyle = ({ isActive }) => ({
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "11px 14px",
  borderRadius: "14px",
  textDecoration: "none",
  fontSize: "14px",
  fontWeight: isActive ? 600 : 500,
  background: isActive ? "var(--accent)" : "transparent",
  color: isActive ? "#ffffff" : "var(--text)",
  transition: "all 0.2s ease",
});

const sectionTitleStyle = {
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--muted)",
  margin: "20px 0 10px",
};

const quickActionStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid var(--line)",
  background: "var(--surface-alt)",
  color: "var(--text)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

function SidebarSection({ title, children }) {
  return (
    <div>
      <div style={sectionTitleStyle}>{title}</div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside
      style={{
        width: "320px",
        background: "var(--card)",
        borderRight: "1px solid var(--line)",
        height: "100vh",
        position: "sticky",
        top: 0,
        padding: "22px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "18px",
        overflowY: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* =====================================================
          BRAND
      ====================================================== */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <img
          src={logo}
          alt="Ulwembu Healthcare logo"
          style={{
            width: "48px",
            height: "48px",
            objectFit: "contain",
          }}
        />

        <div>
          <div
            style={{
              fontWeight: 700,
              color: "var(--ink)",
              fontSize: "16px",
            }}
          >
            Ulwembu Healthcare
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "var(--muted)",
            }}
          >
            Management System
          </div>
        </div>
      </div>

      {/* =====================================================
          FACILITY
      ====================================================== */}
      <div
        style={{
          background: "var(--surface-alt)",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          padding: "16px",
          display: "grid",
          gap: "6px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: "var(--accent)",
            textTransform: "uppercase",
          }}
        >
          Organisation / Facility
        </div>

        <div
          style={{
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          Mamelodi Health Services
        </div>

        <div
          style={{
            fontSize: "13px",
            color: "var(--muted)",
          }}
        >
          Mamelodi West Clinic · Tenant Admin
        </div>
      </div>

      {/* =====================================================
          PLATFORM
      ====================================================== */}
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

      {/* =====================================================
          TENANT ADMINISTRATION
      ====================================================== */}
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

      {/* =====================================================
          PATIENT MANAGEMENT
      ====================================================== */}
      <SidebarSection title="Patient Management">

        {/* Patient List / MPI */}
        <NavLink to="/patients" style={navItemStyle} end>
          <FaUserInjured size={16} />
          <span>Patient List / MPI</span>
        </NavLink>

        {/* Patient Registration */}
        <NavLink to="/patients/register" style={navItemStyle}>
          <FaUserPlus size={16} />
          <span>Patient Registration</span>
        </NavLink>

        {/* Reception */}
        <NavLink to="/reception" style={navItemStyle}>
          <FaClipboardList size={16} />
          <span>Reception & Queue</span>
        </NavLink>

        {/* Queue Board */}
        <NavLink to="/reception/board" style={navItemStyle}>
          <FaClock size={16} />
          <span>Queue Board</span>
        </NavLink>

        {/* Appointments */}
        <NavLink to="/appointments" style={navItemStyle}>
          <FaCalendarCheck size={16} />
          <span>Appointments</span>
        </NavLink>
      </SidebarSection>

      {/* =====================================================
          CLINICAL SERVICES
      ====================================================== */}
      <SidebarSection title="Clinical Services">
        <NavLink to="/clinical" style={navItemStyle}>
          <FaStethoscope size={16} />
          <span>Clinical Services</span>
        </NavLink>
      </SidebarSection>

      {/* =====================================================
          PHARMACY
      ====================================================== */}
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

      {/* =====================================================
          BILLING
      ====================================================== */}
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

      {/* =====================================================
          MANAGEMENT
      ====================================================== */}
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

      {/* =====================================================
          QUICK ACTIONS
      ====================================================== */}
      <div
        style={{
          marginTop: "8px",
          paddingTop: "18px",
          borderTop: "1px solid var(--line)",
          display: "grid",
          gap: "10px",
        }}
      >
        <div style={sectionTitleStyle}>Quick Actions</div>

        <button
          type="button"
          style={quickActionStyle}
          onClick={() => navigate("/patients/register")}
        >
          <FaPlus size={14} />
          Register Patient
        </button>

        <button
          type="button"
          style={quickActionStyle}
          onClick={() => navigate("/reception")}
        >
          <FaPlus size={14} />
          New Visit
        </button>

        <button
          type="button"
          style={quickActionStyle}
          onClick={() => navigate("/pharmacy/dispensing")}
        >
          <FaPlus size={14} />
          Issue Prescription
        </button>
      </div>

      {/* =====================================================
          USER FOOTER
      ====================================================== */}
      <div
        style={{
          marginTop: "auto",
          paddingTop: "18px",
          borderTop: "1px solid var(--line)",
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

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontWeight: 600,
              color: "var(--ink)",
              fontSize: "14px",
            }}
          >
            Amo Admin
          </div>

          <div
            style={{
              fontSize: "12px",
              color: "var(--muted)",
            }}
          >
            Tenant Administrator
          </div>
        </div>
      </div>
    </aside>
  );
}