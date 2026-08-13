import { useMemo, useState } from "react";
import {
  FaUsers,
  FaUserPlus,
  FaUserCheck,
  FaUserClock,
  FaUserTimes,
  FaSearch,
  FaFilter,
  FaEllipsisV,
  FaEnvelope,
  FaPhone,
  FaIdBadge,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";

const staffData = [
  {
    id: "STF-001",
    name: "Amo Admin",
    initials: "AA",
    role: "Tenant Administrator",
    department: "Administration",
    email: "amo.admin@ulwembu.co.za",
    phone: "012 555 0101",
    status: "Active",
    lastLogin: "Today, 09:42",
    employment: "Permanent",
  },
  {
    id: "STF-002",
    name: "Dr. Mokoena",
    initials: "DM",
    role: "Medical Practitioner",
    department: "Clinical",
    email: "dr.mokoena@ulwembu.co.za",
    phone: "012 555 0102",
    status: "Active",
    lastLogin: "Today, 08:17",
    employment: "Permanent",
  },
  {
    id: "STF-003",
    name: "Lerato Ndlovu",
    initials: "LN",
    role: "Registered Nurse",
    department: "Nursing",
    email: "lerato.ndlovu@ulwembu.co.za",
    phone: "012 555 0103",
    status: "Active",
    lastLogin: "Today, 08:51",
    employment: "Permanent",
  },
  {
    id: "STF-004",
    name: "Thabo Molefe",
    initials: "TM",
    role: "Pharmacist",
    department: "Pharmacy",
    email: "thabo.molefe@ulwembu.co.za",
    phone: "012 555 0104",
    status: "Active",
    lastLogin: "Yesterday, 16:28",
    employment: "Permanent",
  },
  {
    id: "STF-005",
    name: "Naledi Maseko",
    initials: "NM",
    role: "Receptionist",
    department: "Reception",
    email: "naledi.maseko@ulwembu.co.za",
    phone: "012 555 0105",
    status: "Pending",
    lastLogin: "Never",
    employment: "Contract",
  },
  {
    id: "STF-006",
    name: "Kabelo Dlamini",
    initials: "KD",
    role: "Finance Officer",
    department: "Finance",
    email: "kabelo.dlamini@ulwembu.co.za",
    phone: "012 555 0106",
    status: "Active",
    lastLogin: "Yesterday, 14:05",
    employment: "Permanent",
  },
  {
    id: "STF-007",
    name: "Zanele Khumalo",
    initials: "ZK",
    role: "Clinical Nurse",
    department: "Nursing",
    email: "zanele.khumalo@ulwembu.co.za",
    phone: "012 555 0107",
    status: "Inactive",
    lastLogin: "05 Aug 2026",
    employment: "Contract",
  },
  {
    id: "STF-008",
    name: "Sipho Mthembu",
    initials: "SM",
    role: "Laboratory Technician",
    department: "Laboratory",
    email: "sipho.mthembu@ulwembu.co.za",
    phone: "012 555 0108",
    status: "Active",
    lastLogin: "Today, 07:45",
    employment: "Permanent",
  },
];

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "18px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "14px",
          background: "#ecfdf5",
          color: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={19} />
      </div>

      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#64748b",
            marginBottom: "3px",
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            marginTop: "3px",
          }}
        >
          {detail}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Active: {
      background: "#dcfce7",
      color: "#166534",
      dot: "#22c55e",
    },
    Pending: {
      background: "#fef3c7",
      color: "#92400e",
      dot: "#f59e0b",
    },
    Inactive: {
      background: "#f1f5f9",
      color: "#64748b",
      dot: "#94a3b8",
    },
  };

  const current = styles[status] || styles.Inactive;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 9px",
        borderRadius: "999px",
        background: current.background,
        color: current.color,
        fontSize: "11px",
        fontWeight: 700,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: current.dot,
        }}
      />
      {status}
    </span>
  );
}

function ActionMenu({ staff }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        display: "inline-block",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "34px",
          height: "34px",
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          color: "#64748b",
          borderRadius: "9px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FaEllipsisV size={13} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "40px",
            width: "155px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "6px",
            boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
            zIndex: 20,
          }}
        >
          {["View Profile", "Edit User", "Reset Password"].map(
            (action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  alert(`${action}: ${staff.name}`);
                  setOpen(false);
                }}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  textAlign: "left",
                  padding: "9px 10px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                {action}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function StaffUsers() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [department, setDepartment] = useState("All");

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staffData.filter((staff) => {
      const matchesSearch =
        !query ||
        staff.name.toLowerCase().includes(query) ||
        staff.role.toLowerCase().includes(query) ||
        staff.id.toLowerCase().includes(query) ||
        staff.email.toLowerCase().includes(query);

      const matchesStatus =
        status === "All" || staff.status === status;

      const matchesDepartment =
        department === "All" ||
        staff.department === department;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDepartment
      );
    });
  }, [search, status, department]);

  const activeCount = staffData.filter(
    (staff) => staff.status === "Active"
  ).length;

  const pendingCount = staffData.filter(
    (staff) => staff.status === "Pending"
  ).length;

  const inactiveCount = staffData.filter(
    (staff) => staff.status === "Inactive"
  ).length;

  return (
    <div
      style={{
        display: "grid",
        gap: "24px",
        paddingBottom: "32px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                background: "#ecfdf5",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FaUsers />
            </div>

            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#0f766e",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Tenant Administration
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Staff & Users
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              color: "#64748b",
            }}
          >
            Manage staff accounts, roles, departments and
            access status for this organisation.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            alert("Add Staff form will be connected next.")
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            border: "none",
            borderRadius: "12px",
            background: "#0f766e",
            color: "#ffffff",
            padding: "11px 16px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FaUserPlus />
          Add Staff
        </button>
      </div>

      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <StatCard
          icon={FaUsers}
          label="Total Staff"
          value={staffData.length}
          detail="Registered users"
        />

        <StatCard
          icon={FaUserCheck}
          label="Active Users"
          value={activeCount}
          detail="Currently active"
        />

        <StatCard
          icon={FaUserClock}
          label="Pending"
          value={pendingCount}
          detail="Awaiting activation"
        />

        <StatCard
          icon={FaUserTimes}
          label="Inactive"
          value={inactiveCount}
          detail="Access disabled"
        />
      </div>

      {/* Directory */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "14px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "18px",
                  color: "#0f172a",
                }}
              >
                Staff Directory
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#94a3b8",
                  fontSize: "12px",
                }}
              >
                {filteredStaff.length} staff members displayed
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              {/* Search */}
              <div
                style={{
                  position: "relative",
                }}
              >
                <FaSearch
                  size={12}
                  style={{
                    position: "absolute",
                    left: "11px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94a3b8",
                  }}
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search staff..."
                  style={{
                    width: "210px",
                    boxSizing: "border-box",
                    border: "1px solid #dbe3ea",
                    borderRadius: "10px",
                    padding: "9px 10px 9px 30px",
                    fontSize: "12px",
                    outline: "none",
                  }}
                />
              </div>

              {/* Status */}
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value)
                }
                style={{
                  border: "1px solid #dbe3ea",
                  borderRadius: "10px",
                  padding: "9px 10px",
                  fontSize: "12px",
                  background: "#ffffff",
                  color: "#334155",
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Inactive">Inactive</option>
              </select>

              {/* Department */}
              <select
                value={department}
                onChange={(event) =>
                  setDepartment(event.target.value)
                }
                style={{
                  border: "1px solid #dbe3ea",
                  borderRadius: "10px",
                  padding: "9px 10px",
                  fontSize: "12px",
                  background: "#ffffff",
                  color: "#334155",
                }}
              >
                <option value="All">All Departments</option>
                <option value="Administration">
                  Administration
                </option>
                <option value="Clinical">Clinical</option>
                <option value="Nursing">Nursing</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Reception">Reception</option>
                <option value="Finance">Finance</option>
                <option value="Laboratory">
                  Laboratory
                </option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("All");
                  setDepartment("All");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  border: "1px solid #dbe3ea",
                  background: "#ffffff",
                  borderRadius: "10px",
                  padding: "9px 11px",
                  fontSize: "12px",
                  color: "#475569",
                  cursor: "pointer",
                }}
              >
                <FaFilter size={10} />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "1050px",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                }}
              >
                {[
                  "Staff Member",
                  "Role",
                  "Department",
                  "Contact",
                  "Employment",
                  "Last Login",
                  "Status",
                  "",
                ].map((heading, index) => (
                  <th
                    key={`${heading}-${index}`}
                    style={{
                      padding:
                        index === 0
                          ? "12px 20px"
                          : "12px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom:
                        "1px solid #e2e8f0",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredStaff.map((staff) => (
                <tr key={staff.id}>
                  {/* Staff */}
                  <td
                    style={{
                      padding: "15px 20px",
                      borderBottom:
                        "1px solid #f1f5f9",
                    }}
                  >
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
                          borderRadius: "12px",
                          background: "#0f766e",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: "12px",
                          flexShrink: 0,
                        }}
                      >
                        {staff.initials}
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {staff.name}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            marginTop: "3px",
                            fontSize: "10px",
                            color: "#94a3b8",
                          }}
                        >
                          <FaIdBadge size={9} />
                          {staff.id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td
                    style={{
                      padding: "15px 12px",
                      borderBottom:
                        "1px solid #f1f5f9",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#334155",
                      }}
                    >
                      {staff.role}
                    </span>
                  </td>

                  {/* Department */}
                  <td
                    style={{
                      padding: "15px 12px",
                      borderBottom:
                        "1px solid #f1f5f9",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        padding: "5px 8px",
                        borderRadius: "7px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        fontSize: "11px",
                        color: "#475569",
                      }}
                    >
                      {staff.department}
                    </span>
                  </td>

                  {/* Contact */}
                  <td
                    style={{
                      padding: "15px 12px",
                      borderBottom:
                        "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: "4px",
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "11px",
                          color: "#475569",
                        }}
                      >
                        <FaEnvelope size={9} />
                        {staff.email}
                      </span>

                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "11px",
                          color: "#94a3b8",
                        }}
                      >
                        <FaPhone size={9} />
                        {staff.phone}
                      </span>
                    </div>
                  </td>

                  {/* Employment */}
                  <td
                    style={{
                      padding: "15px 12px",
                      borderBottom:
                        "1px solid #f1f5f9",
                      fontSize: "11px",
                      color: "#475569",
                    }}
                  >
                    {staff.employment}
                  </td>

                  {/* Last Login */}
                  <td
                    style={{
                      padding: "15px 12px",
                      borderBottom:
                        "1px solid #f1f5f9",
                      fontSize: "11px",
                      color: "#64748b",
                    }}
                  >
                    {staff.lastLogin}
                  </td>

                  {/* Status */}
                  <td
                    style={{
                      padding: "15px 12px",
                      borderBottom:
                        "1px solid #f1f5f9",
                    }}
                  >
                    <StatusBadge status={staff.status} />
                  </td>

                  {/* Actions */}
                  <td
                    style={{
                      padding: "15px 12px",
                      borderBottom:
                        "1px solid #f1f5f9",
                    }}
                  >
                    <ActionMenu staff={staff} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredStaff.length === 0 && (
            <div
              style={{
                padding: "50px 20px",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              <FaUsers
                size={28}
                style={{
                  marginBottom: "10px",
                  opacity: 0.5,
                }}
              />

              <div
                style={{
                  fontWeight: 700,
                  color: "#475569",
                  marginBottom: "4px",
                }}
              >
                No staff members found
              </div>

              <div style={{ fontSize: "12px" }}>
                Try changing your search or filters.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "#94a3b8",
            }}
          >
            Showing {filteredStaff.length} of{" "}
            {staffData.length} staff members
          </span>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <button
              type="button"
              disabled
              style={{
                width: "32px",
                height: "32px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#cbd5e1",
                borderRadius: "8px",
              }}
            >
              <FaChevronLeft size={10} />
            </button>

            <span
              style={{
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0f766e",
                color: "#ffffff",
                borderRadius: "8px",
                fontSize: "11px",
                fontWeight: 700,
              }}
            >
              1
            </span>

            <button
              type="button"
              disabled
              style={{
                width: "32px",
                height: "32px",
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                color: "#cbd5e1",
                borderRadius: "8px",
              }}
            >
              <FaChevronRight size={10} />
            </button>
          </div>
        </div>
      </section>

      {/* Access information */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "15px 18px",
        }}
      >
        <FaIdBadge
          color="#0f766e"
          size={18}
        />

        <div>
          <strong
            style={{
              display: "block",
              fontSize: "12px",
              color: "#334155",
            }}
          >
            User access is organisation-specific
          </strong>

          <span
            style={{
              fontSize: "11px",
              color: "#94a3b8",
            }}
          >
            Staff accounts will eventually be linked to roles,
            permissions and tenant-level access controls.
          </span>
        </div>
      </div>
    </div>
  );
}