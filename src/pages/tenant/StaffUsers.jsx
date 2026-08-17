import { useMemo, useState } from "react";
import {
  FiDownload,
  FiPlus,
  FiSearch,
  FiX,
  FiRefreshCw,
  FiActivity,
} from "react-icons/fi";
import "../../styles/tenant-staff.css";

const initialUsers = [
  {
    id: 1,
    firstName: "Emilio",
    lastName: "Admin",
    email: "admin@mamelodi.example",
    roles: ["Tenant Administrator"],
    clinics: "2 clinics",
    licence: "—",
    mfa: "Optional / off",
    status: "Active",
    lastLogin: "Today 08:12",
  },
  {
    id: 2,
    firstName: "Thabo",
    lastName: "Mahlangu",
    email: "user2@mamelodi-hea.example",
    roles: ["Clinic Manager"],
    clinics: "All clinics",
    licence: "—",
    mfa: "Optional / off",
    status: "Active",
    lastLogin: "Never",
  },
  {
    id: 3,
    firstName: "Lerato",
    lastName: "Dlamini",
    email: "user3@mamelodi-hea.example",
    roles: ["Admin / Reception Officer"],
    clinics: "All clinics",
    licence: "—",
    mfa: "Optional / off",
    status: "Active",
    lastLogin: "Never",
  },
  {
    id: 4,
    firstName: "Mpho",
    lastName: "Nkosi",
    email: "user4@mamelodi-hea.example",
    roles: ["Professional Nurse / Medical Officer"],
    clinics: "All clinics",
    licence: "REG-1003",
    mfa: "Enabled",
    status: "Active",
    lastLogin: "Never",
  },
  {
    id: 5,
    firstName: "Zanele",
    lastName: "Maseko",
    email: "user5@mamelodi-hea.example",
    roles: ["Community Health Nurse"],
    clinics: "All clinics",
    licence: "—",
    mfa: "Optional / off",
    status: "Active",
    lastLogin: "Today 07:44",
  },
  {
    id: 6,
    firstName: "Kabelo",
    lastName: "Mokoena",
    email: "user6@mamelodi-hea.example",
    roles: ["Pharmacist / Assistant Pharmacist"],
    clinics: "All clinics",
    licence: "REG-1005",
    mfa: "Optional / off",
    status: "Active",
    lastLogin: "Never",
  },
  {
    id: 7,
    firstName: "Naledi",
    lastName: "Mahlangu",
    email: "user7@mamelodi-hea.example",
    roles: ["Occupational Health Practitioner"],
    clinics: "All clinics",
    licence: "REG-1006",
    mfa: "Enabled",
    status: "Active",
    lastLogin: "Never",
  },
  {
    id: 8,
    firstName: "Thabo",
    lastName: "Dlamini",
    email: "user8@mamelodi-hea.example",
    roles: ["Billing / Medical Aid Administrator"],
    clinics: "All clinics",
    licence: "—",
    mfa: "Optional / off",
    status: "Active",
    lastLogin: "Never",
  },
];

const roleOptions = [
  "Tenant Administrator",
  "Clinic Manager",
  "Admin / Reception Officer",
  "Professional Nurse / Medical Officer",
  "Community Health Nurse",
  "Pharmacist / Assistant Pharmacist",
  "Occupational Health Practitioner",
  "Billing / Medical Aid Administrator",
];

export default function StaffUsers() {
  const [users, setUsers] = useState(initialUsers);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActivity, setShowActivity] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    clinics: "All clinics",
    licence: "",
    mfa: "Optional / off",
    status: "Active",
  });

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();

      const matchesSearch =
        fullName.includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "All roles" ||
        user.roles.some((role) => role === roleFilter);

      const matchesStatus =
        statusFilter === "All statuses" ||
        user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleAddUser = (event) => {
    event.preventDefault();

    if (!form.firstName || !form.lastName || !form.email || !form.role) {
      alert("Please complete the required fields.");
      return;
    }

    const newUser = {
      id: Date.now(),
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      roles: [form.role],
      clinics: form.clinics,
      licence: form.licence || "—",
      mfa: form.mfa,
      status: form.status,
      lastLogin: "Never",
    };

    setUsers((current) => [newUser, ...current]);

    setForm({
      firstName: "",
      lastName: "",
      email: "",
      role: "",
      clinics: "All clinics",
      licence: "",
      mfa: "Optional / off",
      status: "Active",
    });

    setShowAddUser(false);
  };

  const handleResetPassword = (user) => {
    const confirmed = window.confirm(
      `Reset the password for ${user.firstName} ${user.lastName}?`
    );

    if (confirmed) {
      alert(
        `Password reset initiated for ${user.email}. A temporary password would be generated here when the backend is connected.`
      );
    }
  };

  const handleActivity = (user) => {
    setSelectedUser(user);
    setShowActivity(true);
  };

  const handleExportCSV = () => {
    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Role",
      "Clinics",
      "Licence",
      "MFA",
      "Status",
      "Last Login",
    ];

    const rows = filteredUsers.map((user) => [
      user.firstName,
      user.lastName,
      user.email,
      user.roles.join(" / "),
      user.clinics,
      user.licence,
      user.mfa,
      user.status,
      user.lastLogin,
    ]);

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "tenant-users.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="tenant-staff-page">
      <div className="tenant-staff-header">
        <div>
          <h1>Tenant Users</h1>

          <p>
            Search, inspect and manage people inside each organisation, with
            25-user pagination.
          </p>
        </div>

        <div className="tenant-staff-header-actions">
          <button
            type="button"
            className="staff-secondary-button"
            onClick={handleExportCSV}
          >
            <FiDownload />
            Export CSV
          </button>

          <button
            type="button"
            className="staff-primary-button"
            onClick={() => setShowAddUser(true)}
          >
            <FiPlus />
            Add user
          </button>
        </div>
      </div>

      <div className="tenant-staff-filters">
        <div className="staff-search-wrapper">
          <FiSearch />

          <input
            type="text"
            placeholder="Search name or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
        >
          <option>All roles</option>

          {roleOptions.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option>All statuses</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>

      <section className="tenant-users-card">
        <div className="tenant-users-card-header">
          <div>
            <h2>Mamelodi Health Services</h2>
          </div>

          <span className="matching-users">
            {filteredUsers.length} matching users
          </span>
        </div>

        <div className="tenant-users-table-wrapper">
          <table className="tenant-users-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>ROLE(S)</th>
                <th>CLINICS</th>
                <th>LICENCE</th>
                <th>MFA</th>
                <th>STATUS</th>
                <th>LAST LOGIN</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="staff-empty-state">
                    <FiSearch />

                    <strong>No users found</strong>

                    <span>
                      Try changing your search or filter selections.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="staff-user-cell">
                        <strong>
                          {user.firstName} {user.lastName}
                        </strong>

                        <span>{user.email}</span>
                      </div>
                    </td>

                    <td>
                      <div className="staff-role-cell">
                        {user.roles.map((role) => (
                          <span key={role}>{role}</span>
                        ))}
                      </div>
                    </td>

                    <td>{user.clinics}</td>

                    <td>{user.licence}</td>

                    <td>{user.mfa}</td>

                    <td>
                      <span
                        className={`staff-status ${
                          user.status.toLowerCase()
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>

                    <td>{user.lastLogin}</td>

                    <td>
                      <div className="staff-actions">
                        <button
                          type="button"
                          className="row-action-button"
                          onClick={() => handleActivity(user)}
                        >
                          <FiActivity />
                          Activity
                        </button>

                        <button
                          type="button"
                          className="row-action-button"
                          onClick={() => handleResetPassword(user)}
                        >
                          <FiRefreshCw />
                          Reset password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="tenant-users-footer">
          <span>
            Showing {filteredUsers.length} of {users.length} users
          </span>

          <div className="pagination-placeholder">
            <button type="button" disabled>
              Previous
            </button>

            <span>1</span>

            <button type="button" disabled>
              Next
            </button>
          </div>
        </div>
      </section>

      {showAddUser && (
        <div
          className="staff-modal-overlay"
          onMouseDown={() => setShowAddUser(false)}
        >
          <div
            className="staff-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="staff-modal-header">
              <div>
                <h2>Add user</h2>

                <p>
                  Add a person to Mamelodi Health Services.
                </p>
              </div>

              <button
                type="button"
                className="staff-close-button"
                onClick={() => setShowAddUser(false)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleAddUser}>
              <div className="staff-form-grid">
                <div className="staff-form-group">
                  <label>
                    First name <span>*</span>
                  </label>

                  <input
                    name="firstName"
                    value={form.firstName}
                    onChange={handleFormChange}
                    placeholder="Enter first name"
                  />
                </div>

                <div className="staff-form-group">
                  <label>
                    Last name <span>*</span>
                  </label>

                  <input
                    name="lastName"
                    value={form.lastName}
                    onChange={handleFormChange}
                    placeholder="Enter last name"
                  />
                </div>

                <div className="staff-form-group staff-full-width">
                  <label>
                    Email address <span>*</span>
                  </label>

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                    placeholder="name@mamelodi.example"
                  />
                </div>

                <div className="staff-form-group">
                  <label>
                    Role <span>*</span>
                  </label>

                  <select
                    name="role"
                    value={form.role}
                    onChange={handleFormChange}
                  >
                    <option value="">Select role</option>

                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="staff-form-group">
                  <label>Clinics</label>

                  <select
                    name="clinics"
                    value={form.clinics}
                    onChange={handleFormChange}
                  >
                    <option>All clinics</option>
                    <option>2 clinics</option>
                    <option>Mamelodi West Clinic</option>
                    <option>Mamelodi East Clinic</option>
                  </select>
                </div>

                <div className="staff-form-group">
                  <label>Professional licence</label>

                  <input
                    name="licence"
                    value={form.licence}
                    onChange={handleFormChange}
                    placeholder="e.g. REG-1007"
                  />
                </div>

                <div className="staff-form-group">
                  <label>MFA</label>

                  <select
                    name="mfa"
                    value={form.mfa}
                    onChange={handleFormChange}
                  >
                    <option>Optional / off</option>
                    <option>Enabled</option>
                  </select>
                </div>

                <div className="staff-form-group">
                  <label>Status</label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleFormChange}
                  >
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
              </div>

              <div className="staff-modal-footer">
                <button
                  type="button"
                  className="staff-secondary-button"
                  onClick={() => setShowAddUser(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="staff-primary-button"
                >
                  <FiPlus />
                  Add user
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showActivity && selectedUser && (
        <div
          className="staff-modal-overlay"
          onMouseDown={() => setShowActivity(false)}
        >
          <div
            className="staff-modal activity-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="staff-modal-header">
              <div>
                <h2>User activity</h2>

                <p>
                  {selectedUser.firstName} {selectedUser.lastName}
                </p>
              </div>

              <button
                type="button"
                className="staff-close-button"
                onClick={() => setShowActivity(false)}
              >
                <FiX />
              </button>
            </div>

            <div className="activity-content">
              <div className="activity-item">
                <span className="activity-dot" />

                <div>
                  <strong>Account created</strong>
                  <p>Tenant user account is active.</p>
                  <small>Recent activity</small>
                </div>
              </div>

              <div className="activity-item">
                <span className="activity-dot" />

                <div>
                  <strong>Last login</strong>
                  <p>{selectedUser.lastLogin}</p>
                  <small>{selectedUser.email}</small>
                </div>
              </div>

              <div className="activity-empty">
                Additional audit events will appear here once the backend
                audit service is connected.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}