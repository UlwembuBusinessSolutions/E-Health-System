import { useState } from "react";
import {
  FiPlus,
  FiSearch,
  FiEdit2,
  FiEye,
  FiUsers,
  FiCheckCircle,
  FiClock,
  FiXCircle,
  FiX,
} from "react-icons/fi";

export default function StaffUsers() {
  const [showForm, setShowForm] = useState(false);

  const [staff, setStaff] = useState([
    {
      id: 1,
      name: "Amo Admin",
      employeeId: "UHS-001",
      role: "Organisation Administrator",
      department: "Administration",
      email: "amo.admin@ulwembu.co.za",
      phone: "012 555 0101",
      status: "Active",
    },
    {
      id: 2,
      name: "Dr. Sarah Mokoena",
      employeeId: "UHS-002",
      role: "Doctor",
      department: "Clinical Services",
      email: "sarah.mokoena@ulwembu.co.za",
      phone: "012 555 0102",
      status: "Active",
    },
    {
      id: 3,
      name: "Thabo Nkosi",
      employeeId: "UHS-003",
      role: "Nurse",
      department: "Clinical Services",
      email: "thabo.nkosi@ulwembu.co.za",
      phone: "012 555 0103",
      status: "Active",
    },
  ]);

  const [search, setSearch] = useState("");

  const filteredStaff = staff.filter((person) => {
    const value = search.toLowerCase();

    return (
      person.name.toLowerCase().includes(value) ||
      person.employeeId.toLowerCase().includes(value) ||
      person.role.toLowerCase().includes(value) ||
      person.department.toLowerCase().includes(value)
    );
  });

  const activeCount = staff.filter(
    (person) => person.status === "Active"
  ).length;

  const pendingCount = staff.filter(
    (person) => person.status === "Pending"
  ).length;

  const inactiveCount = staff.filter(
    (person) => person.status === "Inactive"
  ).length;

  function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    const newStaff = {
      id: Date.now(),
      name: formData.get("name"),
      employeeId: formData.get("employeeId"),
      role: formData.get("role"),
      department: formData.get("department"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      status: "Pending",
    };

    setStaff((current) => [...current, newStaff]);

    event.currentTarget.reset();

    setShowForm(false);
  }

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#f6f9fc",
        padding: "30px",
        position: "relative",
      }}
    >
      {/* =========================
          PAGE HEADER
      ========================== */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "28px",
          gap: "20px",
        }}
      >
        <div>
          <div
            style={{
              color: "#64748b",
              fontSize: "13px",
              marginBottom: "8px",
            }}
          >
            Organisation / Staff & Users
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
              color: "#10233f",
            }}
          >
            Staff & Users
          </h1>

          <p
            style={{
              marginTop: "8px",
              color: "#64748b",
              fontSize: "14px",
            }}
          >
            Manage staff members and user access for your organisation.
          </p>
        </div>

        {/* ADD STAFF BUTTON */}

        <button
          type="button"
          onClick={() => {
            console.log("Add Staff clicked");
            setShowForm(true);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "13px 18px",
            background: "#0f766e",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FiPlus size={18} />
          Add Staff
        </button>
      </div>

      {/* =========================
          STATISTICS
      ========================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "18px",
          marginBottom: "24px",
        }}
      >
        <StatCard
          title="Total Staff"
          value={staff.length}
          icon={<FiUsers />}
        />

        <StatCard
          title="Active"
          value={activeCount}
          icon={<FiCheckCircle />}
        />

        <StatCard
          title="Pending"
          value={pendingCount}
          icon={<FiClock />}
        />

        <StatCard
          title="Inactive"
          value={inactiveCount}
          icon={<FiXCircle />}
        />
      </div>

      {/* =========================
          STAFF TABLE
      ========================== */}

      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e3ebf0",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {/* SEARCH */}

        <div
          style={{
            padding: "18px",
            borderBottom: "1px solid #edf2f5",
          }}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "420px",
            }}
          >
            <FiSearch
              size={17}
              color="#94a3b8"
              style={{
                position: "absolute",
                left: "13px",
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />

            <input
              type="text"
              placeholder="Search staff..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px 12px 40px",
                border: "1px solid #dbe5ec",
                borderRadius: "10px",
                outline: "none",
                fontSize: "14px",
              }}
            />
          </div>
        </div>

        {/* TABLE */}

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "900px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  textAlign: "left",
                }}
              >
                <th style={headerStyle}>Staff Member</th>
                <th style={headerStyle}>Employee ID</th>
                <th style={headerStyle}>Role</th>
                <th style={headerStyle}>Department</th>
                <th style={headerStyle}>Contact</th>
                <th style={headerStyle}>Status</th>
                <th style={headerStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredStaff.map((person) => (
                <tr
                  key={person.id}
                  style={{
                    borderTop: "1px solid #edf2f5",
                  }}
                >
                  <td style={cellStyle}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "11px",
                      }}
                    >
                      <div
                        style={{
                          width: "38px",
                          height: "38px",
                          borderRadius: "50%",
                          background: "#e6f4f3",
                          color: "#0f766e",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <FiUsers size={17} />
                      </div>

                      <div>
                        <strong
                          style={{
                            display: "block",
                            color: "#10233f",
                          }}
                        >
                          {person.name}
                        </strong>

                        <small
                          style={{
                            color: "#94a3b8",
                          }}
                        >
                          {person.email}
                        </small>
                      </div>
                    </div>
                  </td>

                  <td style={cellStyle}>
                    {person.employeeId}
                  </td>

                  <td style={cellStyle}>
                    {person.role}
                  </td>

                  <td style={cellStyle}>
                    {person.department}
                  </td>

                  <td style={cellStyle}>
                    {person.phone}
                  </td>

                  <td style={cellStyle}>
                    <span
                      style={{
                        padding: "5px 10px",
                        borderRadius: "20px",
                        background:
                          person.status === "Active"
                            ? "#dcfce7"
                            : person.status === "Pending"
                            ? "#fef3c7"
                            : "#f1f5f9",
                        color:
                          person.status === "Active"
                            ? "#166534"
                            : person.status === "Pending"
                            ? "#92400e"
                            : "#64748b",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {person.status}
                    </span>
                  </td>

                  <td style={cellStyle}>
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                      }}
                    >
                      <button style={actionButton}>
                        <FiEye />
                      </button>

                      <button style={actionButton}>
                        <FiEdit2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================================================
          ADD STAFF MODAL
      ================================================== */}

      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "650px",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: "18px",
              boxShadow: "0 25px 80px rgba(15,23,42,0.3)",
            }}
          >
            {/* MODAL HEADER */}

            <div
              style={{
                padding: "22px 24px",
                borderBottom: "1px solid #e5edf2",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    color: "#10233f",
                    fontSize: "21px",
                  }}
                >
                  Add Staff Member
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#64748b",
                    fontSize: "13px",
                  }}
                >
                  Create a staff account for this organisation.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{
                  width: "36px",
                  height: "36px",
                  border: "none",
                  borderRadius: "9px",
                  background: "#f1f5f9",
                  color: "#475569",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <FiX />
              </button>
            </div>

            {/* FORM */}

            <form onSubmit={handleSubmit}>
              <div
                style={{
                  padding: "24px",
                  display: "grid",
                  gap: "18px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <FormInput
                    label="Full Name"
                    name="name"
                    placeholder="Enter full name"
                    required
                  />

                  <FormInput
                    label="Employee ID"
                    name="employeeId"
                    placeholder="e.g. UHS-006"
                    required
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label style={labelStyle}>
                      Role
                    </label>

                    <select
                      name="role"
                      required
                      defaultValue=""
                      style={inputStyle}
                    >
                      <option value="" disabled>
                        Select role
                      </option>

                      <option>
                        Organisation Administrator
                      </option>

                      <option>Doctor</option>
                      <option>Nurse</option>
                      <option>Receptionist</option>
                      <option>Pharmacist</option>
                      <option>Billing Officer</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>
                      Department
                    </label>

                    <select
                      name="department"
                      required
                      defaultValue=""
                      style={inputStyle}
                    >
                      <option value="" disabled>
                        Select department
                      </option>

                      <option>Administration</option>
                      <option>Clinical Services</option>
                      <option>Reception</option>
                      <option>Pharmacy</option>
                      <option>Billing</option>
                      <option>Management</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "16px",
                  }}
                >
                  <FormInput
                    label="Email Address"
                    name="email"
                    type="email"
                    placeholder="staff@example.com"
                    required
                  />

                  <FormInput
                    label="Phone Number"
                    name="phone"
                    placeholder="012 555 0000"
                    required
                  />
                </div>
              </div>

              {/* MODAL FOOTER */}

              <div
                style={{
                  padding: "18px 24px",
                  borderTop: "1px solid #e5edf2",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: "11px 18px",
                    borderRadius: "9px",
                    border: "1px solid #dbe5ec",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    padding: "11px 20px",
                    borderRadius: "9px",
                    border: "none",
                    background: "#0f766e",
                    color: "#ffffff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


/* ======================================================
   SMALL COMPONENTS
====================================================== */

function StatCard({ title, value, icon }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5edf2",
        borderRadius: "15px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div>
        <div
          style={{
            color: "#64748b",
            fontSize: "13px",
            marginBottom: "7px",
          }}
        >
          {title}
        </div>

        <strong
          style={{
            fontSize: "26px",
            color: "#10233f",
          }}
        >
          {value}
        </strong>
      </div>

      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "11px",
          background: "#e7f4f3",
          color: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>
    </div>
  );
}


function FormInput({
  label,
  name,
  type = "text",
  placeholder,
  required,
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
      </label>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        style={inputStyle}
      />
    </div>
  );
}


/* ======================================================
   STYLES
====================================================== */

const headerStyle = {
  padding: "14px 18px",
  color: "#64748b",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const cellStyle = {
  padding: "16px 18px",
  color: "#475569",
  fontSize: "13px",
  whiteSpace: "nowrap",
};

const actionButton = {
  width: "32px",
  height: "32px",
  border: "1px solid #dbe5ec",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#64748b",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const labelStyle = {
  display: "block",
  marginBottom: "7px",
  color: "#334155",
  fontSize: "13px",
  fontWeight: 700,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #dbe5ec",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#334155",
  fontSize: "14px",
  outline: "none",
};