import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FaIdCard,
  FaPhone,
  FaUserFriends,
  FaShieldAlt,
  FaArrowLeft,
  FaCalendarAlt,
  FaUserCheck,
} from "react-icons/fa";

import { getPatientById } from "../../../services/patientService";
import { addToQueue } from "../../../services/receptionService";

import "../../../styles/tenant-patient-profile.css";

function DetailCard({ title, icon, children }) {
  return (
    <section className="patient-profile-card">
      <div className="patient-profile-card-header">
        <div className="patient-profile-section-icon">
          {icon}
        </div>

        <div>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="patient-profile-card-content">
        {children}
      </div>
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="patient-profile-detail-row">
      <span>{label}</span>

      <strong>
        {value || "—"}
      </strong>
    </div>
  );
}

export default function PatientProfile() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const patient = useMemo(() => {
    return getPatientById(patientId);
  }, [patientId]);

  const getFullName = () => {
    return `${patient?.firstName || ""} ${
      patient?.surname || ""
    }`.trim();
  };

  const handleCheckIn = () => {
    if (!patient) {
      return;
    }

    addToQueue(patient);

    navigate("/tenant/patients/reception");
  };

  if (!patient) {
    return (
      <div className="patient-profile-page">

        <button
          type="button"
          className="patient-profile-back-button"
          onClick={() =>
            navigate("/tenant/patients")
          }
        >
          <FaArrowLeft />
          Back to Patients
        </button>

        <div className="patient-profile-not-found">

          <FaIdCard size={48} />

          <h1>Patient not found</h1>

          <p>
            No patient record exists for MPI:
          </p>

          <strong>
            {patientId || "Unknown"}
          </strong>

          <button
            type="button"
            onClick={() =>
              navigate("/tenant/patients")
            }
          >
            Return to Patient Directory
          </button>

        </div>

      </div>
    );
  }

  return (
    <div className="patient-profile-page">

      {/* ==================================================
          BACK BUTTON
      ================================================== */}

      <button
        type="button"
        className="patient-profile-back-button"
        onClick={() =>
          navigate("/tenant/patients")
        }
      >
        <FaArrowLeft />
        Back to Patients
      </button>

      {/* ==================================================
          PATIENT HEADER
      ================================================== */}

      <section className="patient-profile-hero">

        <div className="patient-profile-hero-left">

          <div className="patient-profile-avatar">
            {patient.firstName?.charAt(0)}
            {patient.surname?.charAt(0)}
          </div>

          <div>

            <div className="patient-profile-eyebrow">
              MASTER PATIENT INDEX
            </div>

            <h1>
              {getFullName()}
            </h1>

            <div className="patient-profile-mpi">
              MPI:

              <strong>
                {patient.id}
              </strong>
            </div>

          </div>

        </div>

        {/* ==================================================
            PATIENT ACTIONS
        ================================================== */}

        <div className="patient-profile-hero-actions">

          <button
            type="button"
            className="patient-check-in-button"
            onClick={() =>{
              addToQueue(patient);
              navigate("/tenant/reception",);
            }}
          >
            <FaUserCheck />
            Check In Patient
          </button>

        </div>

        {/* ==================================================
            STATUS
        ================================================== */}

        <div className="patient-profile-status-panel">

          <span>
            PATIENT STATUS
          </span>

          <strong>
            {patient.status || "Active"}
          </strong>

          <small>
            Registered
          </small>

          <b>
            {patient.registeredDate
              ? new Date(
                  patient.registeredDate
                ).toLocaleDateString()
              : "—"}
          </b>

        </div>

      </section>

      {/* ==================================================
          MAIN INFORMATION
      ================================================== */}

      <div className="patient-profile-grid">

        {/* ==================================================
            DEMOGRAPHICS
        ================================================== */}

        <DetailCard
          title="Demographics"
          icon={<FaIdCard />}
        >

          <DetailRow
            label="MPI"
            value={patient.id}
          />

          <DetailRow
            label="First Name"
            value={patient.firstName}
          />

          <DetailRow
            label="Surname"
            value={patient.surname}
          />

          <DetailRow
            label="Preferred Name"
            value={patient.preferredName}
          />

          <DetailRow
            label="Date of Birth"
            value={patient.dateOfBirth}
          />

          <DetailRow
            label="Gender"
            value={patient.gender}
          />

          <DetailRow
            label="ID / Passport"
            value={patient.idNumber}
          />

        </DetailCard>

        {/* ==================================================
            CONTACT
        ================================================== */}

        <DetailCard
          title="Contact Information"
          icon={<FaPhone />}
        >

          <DetailRow
            label="Mobile Number"
            value={patient.phone}
          />

          <DetailRow
            label="Email Address"
            value={patient.email}
          />

          <DetailRow
            label="Street Address"
            value={patient.address}
          />

          <DetailRow
            label="City"
            value={patient.city}
          />

          <DetailRow
            label="Province"
            value={patient.province}
          />

          <DetailRow
            label="Postal Code"
            value={patient.postalCode}
          />

        </DetailCard>

        {/* ==================================================
            MEDICAL AID
        ================================================== */}

        <DetailCard
          title="Medical Aid Information"
          icon={<FaShieldAlt />}
        >

          <DetailRow
            label="Medical Aid"
            value={patient.medicalAid}
          />

          <DetailRow
            label="Membership Number"
            value={patient.medicalAidNumber}
          />

          <DetailRow
            label="Plan"
            value={patient.medicalAidPlan}
          />

        </DetailCard>

        {/* ==================================================
            EMERGENCY CONTACT
        ================================================== */}

        <DetailCard
          title="Emergency Contact"
          icon={<FaUserFriends />}
        >

          <DetailRow
            label="Full Name"
            value={
              patient.emergencyContactName
            }
          />

          <DetailRow
            label="Relationship"
            value={
              patient.emergencyContactRelationship
            }
          />

          <DetailRow
            label="Contact Number"
            value={
              patient.emergencyContactPhone
            }
          />

        </DetailCard>

      </div>

      {/* ==================================================
          PATIENT TIMELINE
      ================================================== */}

      <section className="patient-profile-timeline">

        <div className="patient-profile-card-header">

          <div className="patient-profile-section-icon">
            <FaCalendarAlt />
          </div>

          <div>

            <h2>
              Patient Timeline
            </h2>

            <p>
              Healthcare activity associated
              with this patient.
            </p>

          </div>

        </div>

        <div className="patient-profile-timeline-grid">

          <div className="patient-profile-timeline-item">
            <strong>
              Appointments
            </strong>

            <span>
              Patient appointments will appear here.
            </span>
          </div>

          <div className="patient-profile-timeline-item">
            <strong>
              Clinical Visits
            </strong>

            <span>
              Clinical consultations will appear here.
            </span>
          </div>

          <div className="patient-profile-timeline-item">
            <strong>
              Prescriptions
            </strong>

            <span>
              Patient prescriptions will appear here.
            </span>
          </div>

          <div className="patient-profile-timeline-item">
            <strong>
              Billing
            </strong>

            <span>
              Patient billing activity will appear here.
            </span>
          </div>

        </div>

      </section>

    </div>
  );
}
