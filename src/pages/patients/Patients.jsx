import { useEffect, useState } from "react";

// Generate tenant-scoped MPI
function generateMPI(tenantCode = "MWC") {
  const sequenceKey = `mpi-sequence-${tenantCode}`;
  const current = Number(localStorage.getItem(sequenceKey) || "1000");
  const next = current + 1;

  localStorage.setItem(sequenceKey, String(next));

  return `${tenantCode}-${new Date().getFullYear()}-${String(next).padStart(6, "0")}`;
}

// Save audit event
function saveAuditEvent(event) {
  const existing = JSON.parse(localStorage.getItem("audit-events") || "[]");

  existing.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...event,
  });

  localStorage.setItem("audit-events", JSON.stringify(existing));
}

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    idNumber: "",
    phone: "",
    gender: "",
    dob: "",
    address: "",
  });

  // Load existing patients on startup
  useEffect(() => {
    const storedPatients = JSON.parse(localStorage.getItem("patients") || "[]");
    setPatients(storedPatients);
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

    // Clear error when user types
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: "",
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const validationErrors = {};

    // Mandatory fields
    if (!form.firstName.trim()) {
      validationErrors.firstName = "First name is required";
    }

    if (!form.lastName.trim()) {
      validationErrors.lastName = "Last name is required";
    }

    if (!form.idNumber.trim()) {
      validationErrors.idNumber = "ID / Passport number is required";
    }

    if (!form.phone.trim()) {
      validationErrors.phone = "Phone number is required";
    }

    if (!form.gender) {
      validationErrors.gender = "Gender is required";
    }

    if (!form.dob) {
      validationErrors.dob = "Date of birth is required";
    }

    // Stop if validation fails
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});

    // Duplicate check
    const duplicate = patients.find(
      (patient) =>
        patient.idNumber === form.idNumber ||
        (patient.firstName.toLowerCase() === form.firstName.toLowerCase() &&
          patient.lastName.toLowerCase() === form.lastName.toLowerCase() &&
          patient.dob === form.dob)
    );

    if (duplicate) {
      alert("Patient already registered in this tenant.");
      return;
    }

    // Generate MPI automatically
    const mpi = generateMPI("MWC");

    // Create patient EPR record
    const newPatient = {
      id: crypto.randomUUID(),
      mpi,
      tenantId: "MAMELODI-WEST-CLINIC",
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      idNumber: form.idNumber.trim(),
      phone: form.phone.trim(),
      gender: form.gender,
      dob: form.dob,
      address: form.address.trim(),
      createdAt: new Date().toISOString(),
      status: "ACTIVE",
    };

    // Save patient permanently
    const updatedPatients = [newPatient, ...patients];
    setPatients(updatedPatients);
    localStorage.setItem("patients", JSON.stringify(updatedPatients));

    // Audit event
    saveAuditEvent({
      eventType: "AUDIT_PATIENT_REGISTERED",
      patientMPI: mpi,
      patientName: `${newPatient.firstName} ${newPatient.lastName}`,
      tenantId: newPatient.tenantId,
    });

    alert(`Patient registered successfully. MPI: ${mpi}`);

    // Reset form
    setForm({
      firstName: "",
      lastName: "",
      idNumber: "",
      phone: "",
      gender: "",
      dob: "",
      address: "",
    });
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      {/* Registration Form */}
      <div style={cardStyle}>
        <div style={{ marginBottom: "20px" }}>
          <h1 style={{ margin: 0, color: "#0f172a", fontSize: "1.9rem" }}>
            Patient Registration
          </h1>
          <p style={{ color: "#64748b", marginTop: "6px" }}>
            Register a new patient and create a permanent Electronic Patient Record (EPR).
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
          }}
        >
          {/* MPI Preview */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Master Patient Index (MPI)</label>
            <input
              value="Automatically generated on save"
              readOnly
              style={{
                ...inputStyle,
                background: "#f8fafc",
                color: "#64748b",
                cursor: "not-allowed",
              }}
            />
          </div>

          {/* First Name */}
          <div>
            <label style={labelStyle}>First Name *</label>
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: errors.firstName ? "#dc2626" : "#cbd5e1",
              }}
            />
            {errors.firstName && <p style={errorStyle}>{errors.firstName}</p>}
          </div>

          {/* Last Name */}
          <div>
            <label style={labelStyle}>Last Name *</label>
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: errors.lastName ? "#dc2626" : "#cbd5e1",
              }}
            />
            {errors.lastName && <p style={errorStyle}>{errors.lastName}</p>}
          </div>

          {/* ID Number */}
          <div>
            <label style={labelStyle}>ID Number / Passport *</label>
            <input
              type="text"
              name="idNumber"
              value={form.idNumber}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: errors.idNumber ? "#dc2626" : "#cbd5e1",
              }}
            />
            {errors.idNumber && <p style={errorStyle}>{errors.idNumber}</p>}
          </div>

          {/* Phone */}
          <div>
            <label style={labelStyle}>Phone Number *</label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: errors.phone ? "#dc2626" : "#cbd5e1",
              }}
            />
            {errors.phone && <p style={errorStyle}>{errors.phone}</p>}
          </div>

          {/* Gender */}
          <div>
            <label style={labelStyle}>Gender *</label>
            <select
              name="gender"
              value={form.gender}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: errors.gender ? "#dc2626" : "#cbd5e1",
              }}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
            {errors.gender && <p style={errorStyle}>{errors.gender}</p>}
          </div>

          {/* Date of Birth */}
          <div>
            <label style={labelStyle}>Date of Birth *</label>
            <input
              type="date"
              name="dob"
              value={form.dob}
              onChange={handleChange}
              style={{
                ...inputStyle,
                borderColor: errors.dob ? "#dc2626" : "#cbd5e1",
              }}
            />
            {errors.dob && <p style={errorStyle}>{errors.dob}</p>}
          </div>

          {/* Address */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Residential Address</label>
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              rows="3"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* Submit */}
          <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
            <button type="submit" style={submitButtonStyle}>
              Save Patient & Create EPR
            </button>
          </div>
        </form>
      </div>

      {/* Registered Patients */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0, color: "#0f172a" }}>Registered Patients</h2>
          <span style={{ color: "#64748b", fontSize: "14px" }}>
            {patients.length} total
          </span>
        </div>

        {patients.length === 0 ? (
          <div style={emptyStateStyle}>No patients registered yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={thStyle}>MPI</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>ID Number</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Gender</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id}>
                  <td style={{ ...tdStyle, fontWeight: 600, color: "#0f766e" }}>
                    {patient.mpi}
                  </td>
                  <td style={tdStyle}>
                    {patient.firstName} {patient.lastName}
                  </td>
                  <td style={tdStyle}>{patient.idNumber}</td>
                  <td style={tdStyle}>{patient.phone}</td>
                  <td style={tdStyle}>{patient.gender}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Styles
const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  outline: "none",
  fontSize: "14px",
  boxSizing: "border-box",
};

const submitButtonStyle = {
  background: "#0f766e",
  color: "white",
  border: "none",
  padding: "12px 18px",
  borderRadius: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const errorStyle = {
  color: "#dc2626",
  fontSize: "12px",
  marginTop: "4px",
};

const emptyStateStyle = {
  padding: "32px",
  textAlign: "center",
  color: "#64748b",
  border: "1px dashed #cbd5e1",
  borderRadius: "14px",
};

const thStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: "13px",
};

const tdStyle = {
  padding: "12px",
  borderBottom: "1px solid #f1f5f9",
  color: "#0f172a",
};