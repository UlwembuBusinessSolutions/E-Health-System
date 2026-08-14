import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaSearch,
  FaUserPlus,
  FaIdCard,
  FaPhone,
  FaCalendarAlt,
  FaVenusMars,
} from "react-icons/fa";

const PATIENT_STORAGE_KEY = "ulwembu_patients";

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const stored = JSON.parse(
      localStorage.getItem(PATIENT_STORAGE_KEY) || "[]"
    );

    setPatients(stored);
  }, []);

  const filteredPatients = patients.filter((patient) => {
    const query = search.toLowerCase();

    return (
      patient.fullName?.toLowerCase().includes(query) ||
      patient.mpi?.toLowerCase().includes(query) ||
      patient.idNumber?.toLowerCase().includes(query)
    );
  });

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
          <h1 style={{ marginBottom: "6px" }}>
            Patient List / Master Patient Index
          </h1>

          <p style={{ color: "var(--muted)", margin: 0 }}>
            Search, view, and manage registered patients across the
            healthcare system.
          </p>
        </div>

        <Link
          to="/patients/register"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 18px",
            borderRadius: "12px",
            background: "var(--accent)",
            color: "white",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          <FaUserPlus size={14} />
          Register Patient
        </Link>
      </div>

      {/* Search */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          padding: "18px",
          boxShadow: "var(--shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 14px",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            background: "var(--surface-alt)",
          }}
        >
          <FaSearch size={14} color="var(--muted)" />

          <input
            type="text"
            placeholder="Search by patient name, MPI, or ID number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              width: "100%",
              fontSize: "14px",
              color: "var(--text)",
            }}
          />
        </div>
      </div>

      {/* Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "18px",
            padding: "18px",
            boxShadow: "var(--shadow)",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Registered Patients
          </div>

          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--ink)",
              marginTop: "8px",
            }}
          >
            {patients.length}
          </div>
        </div>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "18px",
            padding: "18px",
            boxShadow: "var(--shadow)",
          }}
        >
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Active MPI Records
          </div>

          <div
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--ink)",
              marginTop: "8px",
            }}
          >
            {patients.filter((p) => p.status === "Active").length}
          </div>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "var(--shadow)",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Patient Records</h2>

            <p
              style={{
                margin: "4px 0 0",
                color: "var(--muted)",
                fontSize: "14px",
              }}
            >
              Each patient is identified by a unique Master Patient Index
              (MPI).
            </p>
          </div>

          <div style={{ fontSize: "13px", color: "var(--muted)" }}>
            {filteredPatients.length} result
            {filteredPatients.length !== 1 ? "s" : ""}
          </div>
        </div>

        {filteredPatients.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            <FaIdCard size={32} style={{ marginBottom: "12px" }} />

            <div style={{ fontWeight: 600, marginBottom: "6px" }}>
              No patient records found
            </div>

            <div style={{ fontSize: "14px" }}>
              Register your first patient to create an MPI record.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  <th style={thStyle}>MPI</th>
                  <th style={thStyle}>Patient</th>
                  <th style={thStyle}>ID Number</th>
                  <th style={thStyle}>Gender</th>
                  <th style={thStyle}>Contact</th>
                  <th style={thStyle}>Registered</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredPatients.map((patient) => (
                  <tr key={patient.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={tdStyle}>
  <Link
    to={`/patients/${encodeURIComponent(patient.mpi)}`}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      padding: "6px 10px",
      borderRadius: "999px",
      background: "rgba(15, 118, 110, 0.1)",
      color: "var(--accent)",
      fontWeight: 700,
      fontSize: "12px",
      textDecoration: "none",
      transition: "all 0.2s ease",
    }}
  >
    <FaIdCard size={12} />
    {patient.mpi}
  </Link>
</td>

                    <td style={tdStyle}>
                      <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                        {patient.fullName}
                      </div>

                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                        <FaCalendarAlt size={11} style={{ marginRight: "6px" }} />
                        {patient.dateOfBirth || "Not provided"}
                      </div>
                    </td>

                    <td style={tdStyle}>{patient.idNumber}</td>

                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FaVenusMars size={12} color="var(--muted)" />
                        {patient.gender || "—"}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <FaPhone size={12} color="var(--muted)" />
                        {patient.phone || "—"}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      {new Date(patient.registrationDate).toLocaleDateString()}
                    </td>

                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "rgba(22, 163, 74, 0.12)",
                          color: "#166534",
                          fontWeight: 600,
                          fontSize: "12px",
                        }}
                      >
                        {patient.status || "Active"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "14px 18px",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "16px 18px",
  fontSize: "14px",
  color: "var(--text)",
  verticalAlign: "top",
};