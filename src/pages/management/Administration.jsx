import {
  FaUsersCog,
  FaUserShield,
  FaHospital,
  FaMoneyCheckAlt,
  FaCog,
  FaBell,
  FaSave,
  FaPlus,
  FaTrash,
} from "react-icons/fa";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#334155",
  marginBottom: "6px",
  display: "block",
};

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

export default function Administration() {
  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 14px",
              borderRadius: "999px",
              background: "#ccfbf1",
              color: "#0f766e",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "12px",
            }}
          >
            <FaCog size={12} />
            Platform Administration
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "32px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Administration Dashboard
          </h1>

          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            Configure staff, roles, departments, tariffs, notifications, and
            system-wide healthcare administration settings.
          </p>
        </div>

        <button
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 18px",
            borderRadius: "12px",
            border: "none",
            background: "#0f766e",
            color: "#ffffff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FaSave size={14} />
          Save Configuration
        </button>
      </div>

      {/* Quick Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "18px",
        }}
      >
        {[
          { label: "Active Users", value: "84", hint: "6 pending invitations" },
          { label: "Departments", value: "12", hint: "2 recently added" },
          { label: "Roles Configured", value: "9", hint: "RBAC enabled" },
          { label: "Tariff Schedules", value: "4", hint: "Updated this month" },
        ].map((item) => (
          <div key={item.label} style={cardStyle}>
            <div style={{ color: "#64748b", fontSize: "13px" }}>
              {item.label}
            </div>
            <div
              style={{
                marginTop: "10px",
                fontSize: "2rem",
                fontWeight: 800,
                color: "#0f172a",
              }}
            >
              {item.value}
            </div>
            <div style={{ marginTop: "6px", color: "#0f766e", fontSize: "13px" }}>
              {item.hint}
            </div>
          </div>
        ))}
      </div>

      {/* Staff & Roles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "20px",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <FaUsersCog size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Staff & User Management
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Create user accounts and assign departmental access.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <Field label="Full Name">
              <input style={inputStyle} placeholder="Enter staff member name" />
            </Field>

            <Field label="Email Address">
              <input style={inputStyle} placeholder="staff@ulwembu.health" />
            </Field>

            <Field label="Department">
              <select style={inputStyle}>
                <option>Reception</option>
                <option>Clinical Services</option>
                <option>Pharmacy</option>
                <option>Billing</option>
                <option>Administration</option>
              </select>
            </Field>

            <Field label="Role">
              <select style={inputStyle}>
                <option>Tenant Administrator</option>
                <option>Doctor</option>
                <option>Nurse</option>
                <option>Pharmacist</option>
                <option>Receptionist</option>
                <option>Billing Officer</option>
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", gap: "12px", marginTop: "18px" }}>
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "none",
                background: "#0f766e",
                color: "#ffffff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <FaPlus size={12} />
              Add User
            </button>

            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <FaTrash size={12} />
              Deactivate Selected
            </button>
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <FaUserShield size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Role-Based Access
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Configure permissions for operational modules.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {[
              "Patient Management",
              "Reception & Queue",
              "Clinical Consultation",
              "Pharmacy Dispensing",
              "Billing & Claims",
              "Reports & Analytics",
            ].map((item) => (
              <label
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px",
                  color: "#0f172a",
                }}
              >
                <input type="checkbox" defaultChecked />
                {item}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Departments & Tariffs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <FaHospital size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Department Configuration
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Manage clinical and operational departments.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Reception</span>
              <strong>5 staff</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Clinical Services</span>
              <strong>12 staff</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Pharmacy</span>
              <strong>4 staff</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Billing</span>
              <strong>3 staff</strong>
            </div>
          </div>

          <button
            style={{
              marginTop: "18px",
              padding: "12px 16px",
              borderRadius: "12px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Manage Departments
          </button>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <FaMoneyCheckAlt size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Consultation Tariffs
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Configure service fees and billing schedules.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            <Field label="General Consultation">
              <input style={inputStyle} defaultValue="450.00" />
            </Field>

            <Field label="Follow-Up Consultation">
              <input style={inputStyle} defaultValue="280.00" />
            </Field>

            <Field label="Emergency Consultation">
              <input style={inputStyle} defaultValue="850.00" />
            </Field>
          </div>
        </div>
      </div>

      {/* Notifications & System Settings */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
        }}
      >
        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <FaBell size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                Notification Settings
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Configure operational alerts and reminders.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "12px" }}>
            {[
              "Low stock alerts",
              "Outstanding account reminders",
              "Daily operational summary",
              "Critical audit notifications",
            ].map((item) => (
              <label
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "12px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  fontSize: "14px",
                  color: "#0f172a",
                }}
              >
                <input type="checkbox" defaultChecked />
                {item}
              </label>
            ))}
          </div>
        </div>

        <div style={cardStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "18px",
            }}
          >
            <FaCog size={18} color="#0f766e" />
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
                System Preferences
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                Core platform configuration for the current tenant.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            <Field label="Organisation Name">
              <input
                style={inputStyle}
                defaultValue="Mamelodi Health Services"
              />
            </Field>

            <Field label="Default Facility">
              <input
                style={inputStyle}
                defaultValue="Mamelodi West Clinic"
              />
            </Field>

            <Field label="System Time Zone">
              <select style={inputStyle}>
                <option>Africa/Johannesburg</option>
                <option>UTC</option>
              </select>
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}
