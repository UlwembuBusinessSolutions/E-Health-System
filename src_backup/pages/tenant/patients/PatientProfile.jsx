import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaIdCard,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaUserFriends,
  FaShieldAlt,
  FaArrowLeft,
  FaCalendarAlt,
} from "react-icons/fa";

const PATIENT_STORAGE_KEY = "ulwembu_patients";

function DetailCard({ title, icon, children }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "18px",
        padding: "24px",
        boxShadow: "var(--shadow)",
        display: "grid",
        gap: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "var(--ink)",
        }}
      >
        {icon}
        <h2 style={{ margin: 0, fontSize: "18px" }}>{title}</h2>
      </div>

      {children}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: "16px",
        padding: "10px 0",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 600 }}>
        {label}
      </div>

      <div style={{ fontSize: "14px", color: "var(--text)" }}>
        {value || "—"}
      </div>
    </div>
  );
}

export default function PatientProfile() {
  const { mpi } = useParams();
  const navigate = useNavigate();

  const patient = useMemo(() => {
    const patients = JSON.parse(
      localStorage.getItem(PATIENT_STORAGE_KEY) || "[]"
    );

    return patients.find((p) => p.mpi === mpi);
  }, [mpi]);

  if (!patient) {
    return (
      <div style={{ display: "grid", gap: "20px" }}>
        <button
          onClick={() => navigate("/patients")}
          style={{
            width: "fit-content",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            background: "var(--card)",
            cursor: "pointer",
          }}
        >
          <FaArrowLeft size={12} />
          Back to Patients
        </button>

        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "20px",
            padding: "48px",
            textAlign: "center",
            boxShadow: "var(--shadow)",
          }}
        >
          <FaIdCard size={40} style={{ color: "var(--muted)", marginBottom: "16px" }} />
          <h2 style={{ marginBottom: "8px" }}>Patient not found</h2>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No patient record exists for MPI: <strong>{mpi}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <button
        onClick={() => navigate("/patients")}
        style={{
          width: "fit-content",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          borderRadius: "10px",
          border: "1px solid var(--line)",
          background: "var(--card)",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        <FaArrowLeft size={12} />
        Back to Patients
      </button>

      {/* MPI Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--accent), #0f766e)",
          color: "white",
          borderRadius: "24px",
          padding: "28px",
          boxShadow: "var(--shadow)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "8px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "999px",
                background: "rgba(255,255,255,0.16)",
                width: "fit-content",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              <FaIdCard size={12} />
              MASTER PATIENT INDEX
            </div>

            <h1 style={{ margin: 0, color: "white" }}>{patient.fullName}</h1>

            <div style={{ opacity: 0.9, fontSize: "14px" }}>
              MPI: <strong>{patient.mpi}</strong>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "8px",
              minWidth: "220px",
            }}
          >
            <div style={{ fontSize: "12px", opacity: 0.85 }}>PATIENT STATUS</div>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>
              {patient.status || "Active"}
            </div>

            <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "8px" }}>
              REGISTERED
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>
              {new Date(patient.registrationDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "20px",
        }}
      >
        <DetailCard
          title="Demographics"
          icon={<FaIdCard size={16} />}
        >
          <DetailRow label="Full Name" value={patient.fullName} />
          <DetailRow label="Title" value={patient.title} />
          <DetailRow label="Date of Birth" value={patient.dateOfBirth} />
          <DetailRow label="Gender" value={patient.gender} />
          <DetailRow label="Preferred Language" value={patient.preferredLanguage} />
          <DetailRow label="ID / Passport" value={patient.idNumber} />
        </DetailCard>

        <DetailCard
          title="Contact Information"
          icon={<FaPhone size={16} />}
        >
          <DetailRow label="Mobile Number" value={patient.phone} />
          <DetailRow label="Email Address" value={patient.email} />
          <DetailRow label="Street Address" value={patient.address} />
          <DetailRow label="Suburb" value={patient.suburb} />
          <DetailRow label="City" value={patient.city} />
          <DetailRow label="Province" value={patient.province} />
          <DetailRow label="Postal Code" value={patient.postalCode} />
        </DetailCard>

        <DetailCard
          title="Next of Kin"
          icon={<FaUserFriends size={16} />}
        >
          <DetailRow label="Full Name" value={patient.nextOfKinName} />
          <DetailRow label="Relationship" value={patient.nextOfKinRelationship} />
          <DetailRow label="Contact Number" value={patient.nextOfKinPhone} />
        </DetailCard>

        <DetailCard
          title="Medical Aid Information"
          icon={<FaShieldAlt size={16} />}
        >
          <DetailRow label="Medical Aid" value={patient.medicalAid} />
          <DetailRow label="Membership Number" value={patient.medicalAidNumber} />
          <DetailRow label="Plan" value={patient.medicalAidPlan} />
        </DetailCard>
      </div>

      {/* Future Clinical Tabs */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          padding: "24px",
          boxShadow: "var(--shadow)",
          display: "grid",
          gap: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "var(--ink)",
          }}
        >
          <FaCalendarAlt size={16} />
          <h2 style={{ margin: 0, fontSize: "18px" }}>Patient Timeline</h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
          }}
        >
          {[
            "Appointments",
            "Clinical Visits",
            "Prescriptions",
            "Billing",
          ].map((item) => (
            <div
              key={item}
              style={{
                border: "1px solid var(--line)",
                borderRadius: "16px",
                padding: "18px",
                background: "var(--surface-alt)",
                display: "grid",
                gap: "8px",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>{item}</div>
              <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                This section will be connected to the {item.toLowerCase()} module.
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}