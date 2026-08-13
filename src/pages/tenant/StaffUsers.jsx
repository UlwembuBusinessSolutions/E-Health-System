const staffMembers = [
  {
    name: "Amo Admin",
    role: "Tenant Administrator",
    department: "Administration",
    status: "Active",
  },
  {
    name: "Dr. Thabo Nkosi",
    role: "Medical Practitioner",
    department: "Clinical Services",
    status: "Active",
  },
  {
    name: "Lerato Mokoena",
    role: "Reception Officer",
    department: "Reception",
    status: "Active",
  },
  {
    name: "Sibusiso Dlamini",
    role: "Pharmacist",
    department: "Pharmacy",
    status: "Suspended",
  },
];

export default function StaffUsers() {
  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dbe7e4",
          borderRadius: "24px",
          padding: "32px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                color: "#64748b",
                fontSize: "14px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: "8px",
              }}
            >
              Tenant Administration
            </div>

            <h1 style={{ margin: 0, fontSize: "42px", color: "#0f172a" }}>
              Staff & Users
            </h1>

            <p style={{ marginTop: "12px", color: "#64748b", fontSize: "16px" }}>
              Manage healthcare staff, assign system roles, and control tenant-level user access.
            </p>
          </div>

          <button
            style={{
              background: "#0f766e",
              color: "white",
              border: "none",
              borderRadius: "14px",
              padding: "12px 18px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Add Staff Member
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {[
            { label: "Total Staff", value: 28 },
            { label: "Active Users", value: 24 },
            { label: "Clinical Staff", value: 15 },
            { label: "Suspended Accounts", value: 2 },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                padding: "22px",
                textAlign: "center",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "8px" }}>
                {item.label}
              </div>
              <div style={{ fontSize: "34px", fontWeight: 700, color: "#0f172a" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dbe7e4",
            borderRadius: "20px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h2 style={{ margin: 0, color: "#0f172a" }}>Organisation Staff Directory</h2>

            <input
              type="text"
              placeholder="Search staff..."
              style={{
                padding: "10px 12px",
                borderRadius: "12px",
                border: "1px solid #dbe7e4",
                minWidth: "220px",
                outline: "none",
              }}
            />
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={thStyle}>Staff Member</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Department</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {staffMembers.map((member) => (
                <tr key={member.name}>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          background: "#0f766e",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                      >
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{member.name}</div>
                    </div>
                  </td>

                  <td style={tdStyle}>{member.role}</td>
                  <td style={tdStyle}>{member.department}</td>

                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background:
                          member.status === "Active" ? "#ecfdf5" : "#fef2f2",
                        color:
                          member.status === "Active" ? "#047857" : "#b91c1c",
                      }}
                    >
                      {member.status}
                    </span>
                  </td>

                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button style={actionButtonStyle}>Edit</button>
                      <button style={actionButtonStyle}>Reset Password</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "13px",
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle = {
  padding: "16px",
  borderBottom: "1px solid #eef2f7",
  color: "#0f172a",
};

const actionButtonStyle = {
  background: "#f8fafc",
  border: "1px solid #dbe7e4",
  borderRadius: "10px",
  padding: "8px 12px",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
};