import { useState } from "react";
import {
  FaUsers,
  FaUserShield,
  FaHospital,
  FaCog,
  FaPlus,
  FaEdit,
  FaTrash,
} from "react-icons/fa";

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
};

const buttonStyle = {
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: "10px",
  padding: "10px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "10px",
  padding: "8px 14px",
  cursor: "pointer",
  color: "#334155",
};

export default function Administration() {
  const [departments, setDepartments] = useState([
    "Reception",
    "Clinical Services",
    "Pharmacy",
    "Laboratory",
    "Billing",
  ]);

  const [newDepartment, setNewDepartment] = useState("");

  const addDepartment = () => {
    if (!newDepartment.trim()) return;
    setDepartments([...departments, newDepartment.trim()]);
    setNewDepartment("");
  };

  const removeDepartment = (name) => {
    setDepartments(departments.filter((d) => d !== name));
  };

  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
        <div style={{ marginBottom: "28px" }}>
          <div
            style={{
              color: "#64748b",
              fontSize: "14px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            Management
          </div>

          <h1 style={{ fontSize: "44px", margin: 0, color: "#0f172a" }}>
            Administration
          </h1>

          <p style={{ color: "#64748b", fontSize: "16px", marginTop: "12px" }}>
            Configure departments, user roles, permissions, and system-wide administrative settings for the Ulwembu Healthcare platform.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
            marginBottom: "28px",
          }}
        >
          <StatCard icon={<FaUsers size={20} />} label="Active Users" value="124" />
          <StatCard icon={<FaUserShield size={20} />} label="User Roles" value="6" />
          <StatCard icon={<FaHospital size={20} />} label="Departments" value={departments.length.toString()} />
          <StatCard icon={<FaCog size={20} />} label="System Status" value="Healthy" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "24px",
          }}
        >
          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#0f172a" }}>Department Management</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                    Manage operational departments available to clinic staff.
                  </p>
                </div>

                <button style={buttonStyle}>
                  <FaPlus size={12} style={{ marginRight: "8px" }} />
                  New Department
                </button>
              </div>

              <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                <input
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Enter department name"
                  style={{
                    flex: 1,
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #dbe7e4",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />

                <button onClick={addDepartment} style={buttonStyle}>
                  Add
                </button>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {departments.map((department) => (
                  <div
                    key={department}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "10px",
                          background: "#ecfeff",
                          color: "#0f766e",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <FaHospital size={16} />
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{department}</div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>Operational department</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={secondaryButton}>
                        <FaEdit size={12} />
                      </button>

                      <button
                        onClick={() => removeDepartment(department)}
                        style={{
                          ...secondaryButton,
                          color: "#dc2626",
                        }}
                      >
                        <FaTrash size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ margin: 0, color: "#0f172a" }}>Role & Permission Templates</h2>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                    Standard access profiles for common healthcare roles.
                  </p>
                </div>

                <button style={buttonStyle}>Manage Roles</button>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {[
                  { role: "Super Administrator", access: "Full platform access" },
                  { role: "Tenant Administrator", access: "Organisation-wide management" },
                  { role: "Doctor", access: "Clinical records and consultations" },
                  { role: "Receptionist", access: "Registration, queue, and appointments" },
                  { role: "Pharmacist", access: "Dispensing and inventory management" },
                ].map((item) => (
                  <div
                    key={item.role}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "14px 16px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "14px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.role}</div>
                      <div style={{ fontSize: "13px", color: "#64748b" }}>{item.access}</div>
                    </div>

                    <button style={secondaryButton}>View</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px", alignContent: "start" }}>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>System Settings</h2>

              <div style={{ display: "grid", gap: "16px", marginTop: "18px" }}>
                <SettingRow label="Enable patient SMS notifications" defaultChecked />
                <SettingRow label="Allow online appointment requests" defaultChecked />
                <SettingRow label="Require two-factor authentication for administrators" />
                <SettingRow label="Automatic nightly database backup" defaultChecked />
              </div>

              <button style={{ ...buttonStyle, width: "100%", marginTop: "24px" }}>
                Save System Settings
              </button>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Recent Administrative Activity</h2>

              <div style={{ display: "grid", gap: "16px", marginTop: "18px" }}>
                <ActivityItem title="Department added" description="Laboratory Services created by Amo Admin" time="12 minutes ago" />
                <ActivityItem title="User role updated" description="Dr. Nkosi assigned Clinical Supervisor permissions" time="1 hour ago" />
                <ActivityItem title="Security setting changed" description="Two-factor authentication policy updated" time="Today · 08:45" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: "#ecfeff",
          color: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
        }}
      >
        {icon}
      </div>

      <div style={{ fontSize: "14px", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: "32px", fontWeight: 700, color: "#0f172a", marginTop: "6px" }}>
        {value}
      </div>
    </div>
  );
}

function SettingRow({ label, defaultChecked = false }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "12px 0",
        borderBottom: "1px solid #eef2f7",
        color: "#334155",
        fontSize: "14px",
      }}
    >
      <span>{label}</span>
      <input type="checkbox" defaultChecked={defaultChecked} />
    </label>
  );
}

function ActivityItem({ title, description, time }) {
  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div style={{ fontWeight: 600, color: "#0f172a" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "#64748b" }}>{description}</div>
      <div style={{ fontSize: "12px", color: "#94a3b8" }}>{time}</div>
    </div>
  );
}