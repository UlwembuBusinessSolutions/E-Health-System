import { useState } from "react";
import { useNavigate } from "react-router-dom";

const PATIENT_STORAGE_KEY = "ulwembu_patients";

function generateMPI() {
  const patients = JSON.parse(
    localStorage.getItem(PATIENT_STORAGE_KEY) || "[]"
  );

  const year = new Date().getFullYear();

  const nextNumber =
    patients.reduce((highest, patient) => {
      const match = patient.mpi?.match(/MPI-\d{4}-(\d+)/);

      if (!match) return highest;

      return Math.max(highest, Number(match[1]));
    }, 0) + 1;

  return `MPI-${year}-${String(nextNumber).padStart(6, "0")}`;
}

export default function PatientRegistration() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "",
    firstName: "",
    middleName: "",
    surname: "",
    dateOfBirth: "",
    gender: "",
    idType: "South African ID",
    idNumber: "",
    phone: "",
    email: "",
    address: "",
    suburb: "",
    city: "",
    province: "Gauteng",
    postalCode: "",
    nextOfKinName: "",
    nextOfKinRelationship: "",
    nextOfKinPhone: "",
    medicalAid: "",
    medicalAidNumber: "",
    medicalAidPlan: "",
    preferredLanguage: "",
    consent: false,
  });

  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.firstName.trim() || !form.surname.trim()) {
      setError("First name and surname are required.");
      return;
    }

    if (!form.dateOfBirth) {
      setError("Date of birth is required.");
      return;
    }

    if (!form.idNumber.trim()) {
      setError("ID or passport number is required.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Contact number is required.");
      return;
    }

    if (!form.consent) {
      setError("Patient consent must be confirmed.");
      return;
    }

    const existingPatients = JSON.parse(
      localStorage.getItem(PATIENT_STORAGE_KEY) || "[]"
    );

    const duplicate = existingPatients.find(
      (patient) =>
        patient.idNumber.toLowerCase() === form.idNumber.trim().toLowerCase()
    );

    if (duplicate) {
      setError(
        `A patient with this ${form.idType.toLowerCase()} already exists. MPI: ${duplicate.mpi}`
      );
      return;
    }

    const mpi = generateMPI();

    const newPatient = {
      ...form,
      id: crypto.randomUUID(),
      mpi,
      fullName: `${form.firstName} ${form.surname}`,
      status: "Active",
      registrationDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(
      PATIENT_STORAGE_KEY,
      JSON.stringify([...existingPatients, newPatient])
    );

    navigate(`/patients/${encodeURIComponent(mpi)}`);
  }

  const inputStyle = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid var(--line)",
    borderRadius: "10px",
    background: "var(--card)",
    color: "var(--text)",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const labelStyle = {
    display: "grid",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text)",
  };

  const sectionStyle = {
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: "18px",
    padding: "24px",
    boxShadow: "var(--shadow)",
  };

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <div>
        <h1 style={{ marginBottom: "6px" }}>Patient Registration</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Register a new patient and create their Master Patient Index record.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
        <section style={sectionStyle}>
          <h2>Patient Information</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr 1fr",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            <label style={labelStyle}>
              Title
              <select
                name="title"
                value={form.title}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Select</option>
                <option>Mr</option>
                <option>Mrs</option>
                <option>Ms</option>
                <option>Miss</option>
                <option>Dr</option>
              </select>
            </label>

            <label style={labelStyle}>
              First Name *
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Middle Name
              <input
                name="middleName"
                value={form.middleName}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Surname *
              <input
                name="surname"
                value={form.surname}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Date of Birth *
              <input
                type="date"
                name="dateOfBirth"
                value={form.dateOfBirth}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Gender
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
                <option>Prefer not to say</option>
              </select>
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2>Identity Information</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            <label style={labelStyle}>
              Identification Type
              <select
                name="idType"
                value={form.idType}
                onChange={handleChange}
                style={inputStyle}
              >
                <option>South African ID</option>
                <option>Passport</option>
                <option>Refugee Document</option>
                <option>Other</option>
              </select>
            </label>

            <label style={labelStyle}>
              ID / Passport Number *
              <input
                name="idNumber"
                value={form.idNumber}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2>Contact Information</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            <label style={labelStyle}>
              Mobile Number *
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Email Address
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Street Address
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Suburb
              <input
                name="suburb"
                value={form.suburb}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              City
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Province
              <input
                name="province"
                value={form.province}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Postal Code
              <input
                name="postalCode"
                value={form.postalCode}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Preferred Language
              <select
                name="preferredLanguage"
                value={form.preferredLanguage}
                onChange={handleChange}
                style={inputStyle}
              >
                <option value="">Select</option>
                <option>English</option>
                <option>Sepedi</option>
                <option>isiZulu</option>
                <option>Setswana</option>
                <option>Sesotho</option>
                <option>Afrikaans</option>
              </select>
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2>Next of Kin</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            <label style={labelStyle}>
              Full Name
              <input
                name="nextOfKinName"
                value={form.nextOfKinName}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Relationship
              <input
                name="nextOfKinRelationship"
                value={form.nextOfKinRelationship}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Contact Number
              <input
                type="tel"
                name="nextOfKinPhone"
                value={form.nextOfKinPhone}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <h2>Medical Aid</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "16px",
              marginTop: "20px",
            }}
          >
            <label style={labelStyle}>
              Medical Aid
              <input
                name="medicalAid"
                value={form.medicalAid}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Membership Number
              <input
                name="medicalAidNumber"
                value={form.medicalAidNumber}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Plan
              <input
                name="medicalAidPlan"
                value={form.medicalAidPlan}
                onChange={handleChange}
                style={inputStyle}
              />
            </label>
          </div>
        </section>

        <section style={sectionStyle}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              fontSize: "14px",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              name="consent"
              checked={form.consent}
              onChange={handleChange}
              style={{ marginTop: "3px" }}
            />

            <span>
              I confirm that the patient information captured is accurate and
              that the required patient consent has been obtained.
            </span>
          </label>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/patients")}
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              border: "1px solid var(--line)",
              background: "var(--card)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Cancel
          </button>

          <button
            type="submit"
            style={{
              padding: "12px 22px",
              borderRadius: "10px",
              border: "none",
              background: "#0f766e",
              color: "#ffffff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Register Patient
          </button>
        </div>
      </form>
    </div>
  );
}