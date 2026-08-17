import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiUser,
  FiActivity,
  FiClipboard,
  FiFileText,
  FiShield,
  FiCheckCircle,
  FiCalendar,
  FiDroplet,
} from "react-icons/fi";

import "../../../styles/tenant-consultation-summary.css";

const CONSULTATION_STORAGE_KEY =
  "ulwembu_consultations";

export default function ConsultationSummary() {
  const navigate = useNavigate();
  const { consultationId } = useParams();

  const consultation = useMemo(() => {
    const consultations = JSON.parse(
      localStorage.getItem(
        CONSULTATION_STORAGE_KEY
      ) || "[]"
    );

    return consultations.find(
      (item) => item.id === consultationId
    );
  }, [consultationId]);

  // ======================================================
  // PATIENT NAME
  // ======================================================

  const patientName = consultation?.patient
    ? `${consultation.patient.firstName || ""} ${
        consultation.patient.surname || ""
      }`.trim()
    : "Unknown Patient";

  // ======================================================
  // DATE
  // ======================================================

  const formattedDate = consultation?.updatedAt
    ? new Date(
        consultation.updatedAt
      ).toLocaleString()
    : "—";

  // ======================================================
  // NOT FOUND
  // ======================================================

  if (!consultation) {
    return (
      <div className="consultation-summary-page">

        <button
          type="button"
          className="consultation-summary-back"
          onClick={() =>
            navigate(
              "/tenant/clinical/consultations"
            )
          }
        >
          <FiArrowLeft />
          Back to Consultations
        </button>

        <section className="consultation-summary-not-found">

          <FiFileText size={48} />

          <h1>
            Consultation not found
          </h1>

          <p>
            No consultation record exists for:
          </p>

          <strong>
            {consultationId || "Unknown"}
          </strong>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/tenant/clinical/consultations"
              )
            }
          >
            Return to Consultations
          </button>

        </section>

      </div>
    );
  }

  return (
    <div className="consultation-summary-page">

      {/* ==================================================
          BACK BUTTON
      ================================================== */}

      <button
        type="button"
        className="consultation-summary-back"
        onClick={() =>
          navigate(
            "/tenant/clinical/consultations"
          )
        }
      >
        <FiArrowLeft />
        Back to Consultations
      </button>

      {/* ==================================================
          COMPLETION HEADER
      ================================================== */}

      <section className="consultation-summary-success">

        <div className="consultation-summary-success-icon">
          <FiCheckCircle />
        </div>

        <div>

          <div className="consultation-summary-eyebrow">
            CLINICAL SERVICES
          </div>

          <h1>
            Consultation Completed
          </h1>

          <p>
            The consultation has been successfully
            completed and recorded.
          </p>

        </div>

        <div className="consultation-summary-status">

          <span>
            STATUS
          </span>

          <strong>
            {consultation.status ||
              "Completed"}
          </strong>

        </div>

      </section>

      {/* ==================================================
          CONSULTATION INFORMATION
      ================================================== */}

      <section className="consultation-summary-card">

        <div className="consultation-summary-card-header">

          <div className="consultation-summary-section-icon">
            <FiCalendar />
          </div>

          <div>

            <h2>
              Consultation Information
            </h2>

            <p>
              Details about this clinical
              encounter.
            </p>

          </div>

        </div>

        <div className="consultation-summary-info-grid">

          <div>
            <span>
              Consultation ID
            </span>

            <strong>
              {consultation.id}
            </strong>
          </div>

          <div>
            <span>
              Date & Time
            </span>

            <strong>
              {formattedDate}
            </strong>
          </div>

          <div>
            <span>
              Status
            </span>

            <strong className="summary-status">
              {consultation.status ||
                "Completed"}
            </strong>
          </div>

        </div>

      </section>

      {/* ==================================================
          PATIENT
      ================================================== */}

      <section className="consultation-summary-card">

        <div className="consultation-summary-card-header">

          <div className="consultation-summary-section-icon">
            <FiUser />
          </div>

          <div>

            <h2>
              Patient
            </h2>

            <p>
              Patient associated with this
              consultation.
            </p>

          </div>

        </div>

        <div className="consultation-summary-patient">

          <div className="consultation-summary-avatar">

            {consultation.patient?.firstName?.charAt(
              0
            )}

            {consultation.patient?.surname?.charAt(
              0
            )}

          </div>

          <div>

            <h3>
              {patientName}
            </h3>

            <span>
              MPI:{" "}
              <strong>
                {consultation.patient?.id ||
                  consultation.patientId}
              </strong>
            </span>

          </div>

        </div>

        <div className="consultation-summary-demographics">

          <div>
            <span>
              Date of Birth
            </span>

            <strong>
              {consultation.patient
                ?.dateOfBirth || "—"}
            </strong>
          </div>

          <div>
            <span>
              Gender
            </span>

            <strong>
              {consultation.patient?.gender ||
                "—"}
            </strong>
          </div>

          <div>
            <span>
              Mobile Number
            </span>

            <strong>
              {consultation.patient?.phone ||
                "—"}
            </strong>
          </div>

          <div>
            <span>
              Medical Aid
            </span>

            <strong>
              {consultation.patient
                ?.medicalAid || "None"}
            </strong>
          </div>

        </div>

        <div className="consultation-summary-patient-action">

          <button
            type="button"
            onClick={() =>
              navigate(
                `/tenant/patients/${consultation.patient?.id}`
              )
            }
          >
            <FiUser />
            View Patient Profile
          </button>

        </div>

      </section>

      {/* ==================================================
          CHIEF COMPLAINT
      ================================================== */}

      <section className="consultation-summary-card">

        <div className="consultation-summary-card-header">

          <div className="consultation-summary-section-icon">
            <FiClipboard />
          </div>

          <div>

            <h2>
              Chief Complaint
            </h2>

            <p>
              Reason for the consultation.
            </p>

          </div>

        </div>

        <div className="consultation-summary-text">

          {consultation.chiefComplaint ||
            "No chief complaint recorded."}

        </div>

      </section>

      {/* ==================================================
          VITAL SIGNS
      ================================================== */}

      <section className="consultation-summary-card">

        <div className="consultation-summary-card-header">

          <div className="consultation-summary-section-icon">
            <FiActivity />
          </div>

          <div>

            <h2>
              Vital Signs
            </h2>

            <p>
              Clinical observations recorded
              during the consultation.
            </p>

          </div>

        </div>

        <div className="consultation-summary-vitals">

          <div>
            <span>
              Blood Pressure
            </span>

            <strong>
              {consultation.vitals
                ?.bloodPressure || "—"}
            </strong>
          </div>

          <div>
            <span>
              Pulse
            </span>

            <strong>
              {consultation.vitals
                ?.pulse || "—"}
              {consultation.vitals?.pulse &&
                " bpm"}
            </strong>
          </div>

          <div>
            <span>
              Temperature
            </span>

            <strong>
              {consultation.vitals
                ?.temperature || "—"}
              {consultation.vitals
                ?.temperature && " °C"}
            </strong>
          </div>

          <div>
            <span>
              Respiratory Rate
            </span>

            <strong>
              {consultation.vitals
                ?.respiratoryRate || "—"}
            </strong>
          </div>

          <div>
            <span>
              Oxygen Saturation
            </span>

            <strong>
              {consultation.vitals
                ?.oxygenSaturation || "—"}
              {consultation.vitals
                ?.oxygenSaturation && "%"}
            </strong>
          </div>

          <div>
            <span>
              Weight
            </span>

            <strong>
              {consultation.vitals?.weight ||
                "—"}
              {consultation.vitals?.weight &&
                " kg"}
            </strong>
          </div>

          <div>
            <span>
              Height
            </span>

            <strong>
              {consultation.vitals?.height ||
                "—"}
              {consultation.vitals?.height &&
                " cm"}
            </strong>
          </div>

        </div>

      </section>

      {/* ==================================================
          CLINICAL NOTES
      ================================================== */}

      <section className="consultation-summary-card">

        <div className="consultation-summary-card-header">

          <div className="consultation-summary-section-icon">
            <FiFileText />
          </div>

          <div>

            <h2>
              Clinical Notes
            </h2>

            <p>
              Clinical history and observations.
            </p>

          </div>

        </div>

        <div className="consultation-summary-text">

          {consultation.clinicalNotes ||
            "No clinical notes recorded."}

        </div>

      </section>

      {/* ==================================================
          ASSESSMENT
      ================================================== */}

      <section className="consultation-summary-card">

        <div className="consultation-summary-card-header">

          <div className="consultation-summary-section-icon">
            <FiClipboard />
          </div>

          <div>

            <h2>
              Assessment
            </h2>

            <p>
              Clinician's assessment of the
              patient.
            </p>

          </div>

        </div>

        <div className="consultation-summary-text">

          {consultation.assessment ||
            "No assessment recorded."}

        </div>

      </section>

      {/* ==================================================
          CLINICAL ACTIONS
      ================================================== */}

      <section className="consultation-summary-card">

        <div className="consultation-summary-card-header">

          <div className="consultation-summary-section-icon">
            <FiActivity />
          </div>

          <div>

            <h2>
              Clinical Actions
            </h2>

            <p>
              Diagnosis, laboratory requests,
              prescriptions and referrals.
            </p>

          </div>

        </div>

        <div className="consultation-summary-actions-grid">

          {/* DIAGNOSIS */}

          <div className="consultation-summary-action">

            <div className="consultation-summary-action-title">

              <FiActivity />

              <strong>
                Diagnosis
              </strong>

            </div>

            <p>
              {consultation.diagnosis ||
                "No diagnosis recorded."}
            </p>

          </div>

          {/* LABORATORY */}

          <div className="consultation-summary-action">

            <div className="consultation-summary-action-title">

              <FiDroplet />

              <strong>
                Laboratory
              </strong>

            </div>

            <p>
              {consultation.laboratoryRequest ||
                "No laboratory request recorded."}
            </p>

          </div>

          {/* PRESCRIPTION */}

          <div className="consultation-summary-action">

            <div className="consultation-summary-action-title">

              <FiFileText />

              <strong>
                Prescription
              </strong>

            </div>

            <p>
              {consultation.prescription ||
                "No prescription recorded."}
            </p>

          </div>

          {/* REFERRAL */}

          <div className="consultation-summary-action">

            <div className="consultation-summary-action-title">

              <FiShield />

              <strong>
                Referral
              </strong>

            </div>

            <p>
              {consultation.referral ||
                "No referral recorded."}
            </p>

          </div>

        </div>

      </section>

      {/* ==================================================
          FOOTER ACTIONS
      ================================================== */}

      <div className="consultation-summary-actions">

        <button
          type="button"
          className="consultation-summary-secondary"
          onClick={() =>
            navigate(
              "/tenant/clinical/consultations"
            )
          }
        >
          <FiArrowLeft />
          Back to Consultations
        </button>

        <button
          type="button"
          className="consultation-summary-primary"
          onClick={() =>
            navigate(
              `/tenant/patients/${consultation.patient?.id}`
            )
          }
        >
          <FiUser />
          View Patient Profile
        </button>

        <button
          type="button"
          className="consultation-summary-new"
          onClick={() =>
            navigate(
              "/tenant/clinical/consultations"
            )
          }
        >
          <FiPlus />
          New Consultation
        </button>

      </div>

    </div>
  );
}
