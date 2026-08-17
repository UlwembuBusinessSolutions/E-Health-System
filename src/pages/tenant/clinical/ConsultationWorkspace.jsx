import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  FiArrowLeft,
  FiSearch,
  FiUser,
  FiActivity,
  FiClipboard,
  FiAlertCircle,
  FiCheck,
  FiPlus,
  FiFileText,
  FiShield,
} from "react-icons/fi";

import { getPatients } from "../../../services/patientService";
import "../../../styles/tenant-consultation-workspace.css";

const CONSULTATION_STORAGE_KEY =
  "ulwembu_completed_consultation";

export default function ConsultationWorkspace() {
  const navigate = useNavigate();
  const { consultationId } = useParams();

  // ======================================================
  // PATIENTS
  // ======================================================

  const patients = useMemo(() => getPatients(), []);

  // ======================================================
  // STATE
  // ======================================================

  const [selectedPatient, setSelectedPatient] =
    useState(null);

  const [patientSearch, setPatientSearch] =
    useState("");

  const [form, setForm] = useState({
    chiefComplaint: "",
    clinicalNotes: "",
    assessment: "",

    bloodPressure: "",
    pulse: "",
    temperature: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    weight: "",
    height: "",

    diagnosis: "",
    laboratoryRequest: "",
    prescription: "",
    referral: "",
  });

  // ======================================================
  // SEARCH PATIENTS
  // ======================================================

  const filteredPatients = useMemo(() => {
    const search = patientSearch.trim().toLowerCase();

    if (!search) {
      return patients.slice(0, 8);
    }

    return patients.filter((patient) => {
      const fullName =
        `${patient.firstName || ""} ${
          patient.surname || ""
        }`.toLowerCase();

      return (
        fullName.includes(search) ||
        patient.id?.toLowerCase().includes(search) ||
        patient.idNumber
          ?.toLowerCase()
          .includes(search) ||
        patient.phone?.toLowerCase().includes(search)
      );
    });
  }, [patients, patientSearch]);

  // ======================================================
  // FORM CHANGE
  // ======================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ======================================================
  // SELECT PATIENT
  // ======================================================

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setPatientSearch("");
  };

  // ======================================================
  // COMPLETE CONSULTATION
  // ======================================================

  const handleComplete = () => {
    if (!selectedPatient) {
      alert("Please select a patient before completing the consultation.");
      return;
    }

    const newConsultationId =
      consultationId || `CONS-${Date.now()}`;

    const now = new Date().toISOString();

    const consultation = {
      id: newConsultationId,

      patientId: selectedPatient.id,

      patient: selectedPatient,

      chiefComplaint: form.chiefComplaint,

      clinicalNotes: form.clinicalNotes,

      assessment: form.assessment,

      vitalSigns: {
        bloodPressure: form.bloodPressure,
        pulse: form.pulse,
        temperature: form.temperature,
        respiratoryRate: form.respiratoryRate,
        oxygenSaturation: form.oxygenSaturation,
        weight: form.weight,
        height: form.height,
      },

      diagnosis: form.diagnosis,

      laboratoryRequest: form.laboratoryRequest,

      prescription: form.prescription,

      referral: form.referral,

      status: "Completed",

      startedAt: now,

      completedAt: now,
    };

    // ====================================================
    // SAVE CONSULTATION
    // ====================================================

    localStorage.setItem(
      CONSULTATION_STORAGE_KEY,
      JSON.stringify(consultation)
    );

    // ====================================================
    // GO DIRECTLY TO SUMMARY
    // ====================================================

    navigate(
      `/tenant/clinical/consultations/${newConsultationId}/summary`
    );
  };

  // ======================================================
  // PATIENT NAME
  // ======================================================

  const fullName = selectedPatient
    ? `${selectedPatient.firstName || ""} ${
        selectedPatient.surname || ""
      }`.trim()
    : "";

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="consultation-workspace-page">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="consultation-workspace-header">

        <div>

          <button
            type="button"
            className="consultation-workspace-back"
            onClick={() =>
              navigate("/tenant/clinical/consultations")
            }
          >
            <FiArrowLeft />
            Back to Clinical Services
          </button>

          <div className="tenant-page-eyebrow">
            CLINICAL SERVICES
          </div>

          <h1>
            Consultation Workspace
          </h1>

          <p>
            Conduct and document a complete patient
            consultation.
          </p>

        </div>

        <div className="consultation-workspace-id">

          <span>
            CONSULTATION
          </span>

          <strong>
            {consultationId || "In Progress"}
          </strong>

        </div>

      </div>

      {/* ==================================================
          PATIENT SELECTION
      ================================================== */}

      <section className="consultation-workspace-card">

        <div className="consultation-card-header">

          <div className="consultation-card-title-icon">
            <FiSearch />
          </div>

          <div>

            <h2>
              Select Patient
            </h2>

            <p>
              Search for the patient who is being consulted.
            </p>

          </div>

        </div>

        {!selectedPatient ? (
          <>

            <div className="consultation-patient-search">

              <FiSearch />

              <input
                type="text"
                value={patientSearch}
                onChange={(event) =>
                  setPatientSearch(event.target.value)
                }
                placeholder="Search by patient name, MPI, ID number or phone..."
              />

            </div>

            <div className="consultation-patient-results">

              {filteredPatients.length === 0 ? (

                <div className="consultation-no-patients">

                  <FiUser />

                  <span>
                    No patients found
                  </span>

                </div>

              ) : (

                filteredPatients.map((patient) => {

                  const name =
                    `${patient.firstName || ""} ${
                      patient.surname || ""
                    }`.trim();

                  return (

                    <button
                      type="button"
                      className="consultation-patient-result"
                      key={patient.id}
                      onClick={() =>
                        selectPatient(patient)
                      }
                    >

                      <div className="consultation-patient-avatar">

                        {patient.firstName?.charAt(0)}

                        {patient.surname?.charAt(0)}

                      </div>

                      <div className="consultation-result-details">

                        <strong>
                          {name}
                        </strong>

                        <span>
                          {patient.id}
                        </span>

                      </div>

                      <div className="consultation-result-meta">

                        <span>
                          {patient.gender || "—"}
                        </span>

                        <span>
                          {patient.phone || "—"}
                        </span>

                      </div>

                    </button>

                  );
                })

              )}

            </div>

          </>

        ) : (

          <div className="selected-patient">

            <div className="selected-patient-main">

              <div className="selected-patient-avatar">

                {selectedPatient.firstName?.charAt(0)}

                {selectedPatient.surname?.charAt(0)}

              </div>

              <div>

                <span className="selected-patient-label">
                  SELECTED PATIENT
                </span>

                <h3>
                  {fullName}
                </h3>

                <strong>
                  {selectedPatient.id}
                </strong>

              </div>

            </div>

            <button
              type="button"
              className="change-patient-button"
              onClick={() =>
                setSelectedPatient(null)
              }
            >
              Change Patient
            </button>

          </div>

        )}

      </section>

      {/* ==================================================
          PATIENT DEMOGRAPHICS
      ================================================== */}

      {selectedPatient && (

        <section className="consultation-workspace-card">

          <div className="consultation-card-header">

            <div className="consultation-card-title-icon">
              <FiUser />
            </div>

            <div>

              <h2>
                Patient Demographics
              </h2>

              <p>
                Patient information from the master
                patient record.
              </p>

            </div>

          </div>

          <div className="consultation-demographics-grid">

            <div>
              <span>Full Name</span>
              <strong>
                {fullName || "—"}
              </strong>
            </div>

            <div>
              <span>MPI</span>
              <strong>
                {selectedPatient.id || "—"}
              </strong>
            </div>

            <div>
              <span>ID / Passport</span>
              <strong>
                {selectedPatient.idNumber || "—"}
              </strong>
            </div>

            <div>
              <span>Date of Birth</span>
              <strong>
                {selectedPatient.dateOfBirth || "—"}
              </strong>
            </div>

            <div>
              <span>Gender</span>
              <strong>
                {selectedPatient.gender || "—"}
              </strong>
            </div>

            <div>
              <span>Mobile Number</span>
              <strong>
                {selectedPatient.phone || "—"}
              </strong>
            </div>

            <div>
              <span>Medical Aid</span>
              <strong>
                {selectedPatient.medicalAid || "None"}
              </strong>
            </div>

            <div>
              <span>Membership Number</span>
              <strong>
                {selectedPatient.medicalAidNumber || "—"}
              </strong>
            </div>

          </div>

        </section>

      )}

      {/* ==================================================
          CLINICAL WORKSPACE
      ================================================== */}

      {selectedPatient && (

        <>

          {/* ==================================================
              CHIEF COMPLAINT
          ================================================== */}

          <section className="consultation-workspace-card">

            <div className="consultation-card-header">

              <div className="consultation-card-title-icon">
                <FiAlertCircle />
              </div>

              <div>

                <h2>
                  Chief Complaint
                </h2>

                <p>
                  Record the patient's primary reason
                  for the consultation.
                </p>

              </div>

            </div>

            <textarea
              name="chiefComplaint"
              value={form.chiefComplaint}
              onChange={handleChange}
              placeholder="Enter the patient's chief complaint..."
              rows="4"
            />

          </section>

          {/* ==================================================
              VITAL SIGNS
          ================================================== */}

          <section className="consultation-workspace-card">

            <div className="consultation-card-header">

              <div className="consultation-card-title-icon">
                <FiActivity />
              </div>

              <div>

                <h2>
                  Vital Signs
                </h2>

                <p>
                  Capture the patient's current clinical
                  observations.
                </p>

              </div>

            </div>

            <div className="consultation-form-grid">

              <div>
                <label>
                  Blood Pressure
                </label>

                <input
                  name="bloodPressure"
                  value={form.bloodPressure}
                  onChange={handleChange}
                  placeholder="e.g. 120/80"
                />
              </div>

              <div>
                <label>
                  Pulse
                </label>

                <input
                  name="pulse"
                  value={form.pulse}
                  onChange={handleChange}
                  placeholder="bpm"
                />
              </div>

              <div>
                <label>
                  Temperature
                </label>

                <input
                  name="temperature"
                  value={form.temperature}
                  onChange={handleChange}
                  placeholder="°C"
                />
              </div>

              <div>
                <label>
                  Respiratory Rate
                </label>

                <input
                  name="respiratoryRate"
                  value={form.respiratoryRate}
                  onChange={handleChange}
                  placeholder="breaths/min"
                />
              </div>

              <div>
                <label>
                  Oxygen Saturation
                </label>

                <input
                  name="oxygenSaturation"
                  value={form.oxygenSaturation}
                  onChange={handleChange}
                  placeholder="%"
                />
              </div>

              <div>
                <label>
                  Weight
                </label>

                <input
                  name="weight"
                  value={form.weight}
                  onChange={handleChange}
                  placeholder="kg"
                />
              </div>

              <div>
                <label>
                  Height
                </label>

                <input
                  name="height"
                  value={form.height}
                  onChange={handleChange}
                  placeholder="cm"
                />
              </div>

            </div>

          </section>

          {/* ==================================================
              CLINICAL NOTES
          ================================================== */}

          <section className="consultation-workspace-card">

            <div className="consultation-card-header">

              <div className="consultation-card-title-icon">
                <FiFileText />
              </div>

              <div>

                <h2>
                  Clinical Notes
                </h2>

                <p>
                  Record the clinical history and
                  observations.
                </p>

              </div>

            </div>

            <textarea
              name="clinicalNotes"
              value={form.clinicalNotes}
              onChange={handleChange}
              placeholder="Enter clinical notes..."
              rows="6"
            />

          </section>

          {/* ==================================================
              ASSESSMENT
          ================================================== */}

          <section className="consultation-workspace-card">

            <div className="consultation-card-header">

              <div className="consultation-card-title-icon">
                <FiClipboard />
              </div>

              <div>

                <h2>
                  Assessment
                </h2>

                <p>
                  Record the clinician's assessment.
                </p>

              </div>

            </div>

            <textarea
              name="assessment"
              value={form.assessment}
              onChange={handleChange}
              placeholder="Enter clinical assessment..."
              rows="5"
            />

          </section>

          {/* ==================================================
              CLINICAL ACTIONS
          ================================================== */}

          <section className="consultation-workspace-card">

            <div className="consultation-card-header">

              <div className="consultation-card-title-icon">
                <FiActivity />
              </div>

              <div>

                <h2>
                  Clinical Actions
                </h2>

                <p>
                  Record the outcome and required
                  follow-up clinical actions.
                </p>

              </div>

            </div>

            <div className="consultation-actions-grid">

              {/* DIAGNOSIS */}

              <div className="consultation-action-box">

                <div>
                  <FiActivity />
                  <strong>
                    Diagnosis
                  </strong>
                </div>

                <textarea
                  name="diagnosis"
                  value={form.diagnosis}
                  onChange={handleChange}
                  placeholder="Enter diagnosis..."
                  rows="4"
                />

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/tenant/clinical/diagnosis"
                    )
                  }
                >
                  <FiPlus />
                  Manage Diagnosis
                </button>

              </div>

              {/* LABORATORY */}

              <div className="consultation-action-box">

                <div>
                  <FiClipboard />
                  <strong>
                    Laboratory
                  </strong>
                </div>

                <textarea
                  name="laboratoryRequest"
                  value={form.laboratoryRequest}
                  onChange={handleChange}
                  placeholder="Enter laboratory request..."
                  rows="4"
                />

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/tenant/clinical/laboratory"
                    )
                  }
                >
                  <FiPlus />
                  Request Laboratory Tests
                </button>

              </div>

              {/* PRESCRIPTION */}

              <div className="consultation-action-box">

                <div>
                  <FiFileText />
                  <strong>
                    Prescription
                  </strong>
                </div>

                <textarea
                  name="prescription"
                  value={form.prescription}
                  onChange={handleChange}
                  placeholder="Enter prescription notes..."
                  rows="4"
                />

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/tenant/clinical/prescriptions"
                    )
                  }
                >
                  <FiPlus />
                  Create Prescription
                </button>

              </div>

              {/* REFERRAL */}

              <div className="consultation-action-box">

                <div>
                  <FiShield />
                  <strong>
                    Referral
                  </strong>
                </div>

                <textarea
                  name="referral"
                  value={form.referral}
                  onChange={handleChange}
                  placeholder="Enter referral details..."
                  rows="4"
                />

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/tenant/clinical/referrals"
                    )
                  }
                >
                  <FiPlus />
                  Create Referral
                </button>

              </div>

            </div>

          </section>

          {/* ==================================================
              ACTION BAR
          ================================================== */}

          <div className="consultation-workspace-actions">

            <button
              type="button"
              className="consultation-cancel-button"
              onClick={() =>
                navigate(
                  "/tenant/clinical/consultations"
                )
              }
            >
              Cancel
            </button>

            <button
              type="button"
              className="consultation-complete-button"
              onClick={handleComplete}
            >
              <FiCheck />
              Complete Consultation
            </button>

          </div>

        </>

      )}

    </div>
  );
}