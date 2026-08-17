import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheck,
  FiPlus,
  FiTrash2,
  FiAlertCircle,
  FiUser,
  FiCalendar,
  FiPhone,
} from "react-icons/fi";

import "../../../styles/tenant-diagnosis.css";

const CONSULTATION_STORAGE_KEY =
  "ulwembu_current_consultation";

const DIAGNOSIS_STORAGE_KEY =
  "ulwembu_consultation_assessment";

export default function Diagnosis() {
  const navigate = useNavigate();

  const [consultation, setConsultation] =
    useState(null);

  const [assessment, setAssessment] =
    useState("");

  const [diagnoses, setDiagnoses] = useState([
    {
      id: Date.now(),
      type: "Primary",
      diagnosis: "",
      icd10: "",
      notes: "",
    },
  ]);

  const [saved, setSaved] = useState(false);

  /*
   * LOAD CURRENT CONSULTATION
   */

  useEffect(() => {
    const storedConsultation =
      localStorage.getItem(
        CONSULTATION_STORAGE_KEY
      );

    if (!storedConsultation) {
      return;
    }

    try {
      const parsed =
        JSON.parse(storedConsultation);

      setConsultation(parsed);

      /*
       * Load previously saved diagnosis
       */

      const storedDiagnosis =
        localStorage.getItem(
          DIAGNOSIS_STORAGE_KEY
        );

      if (storedDiagnosis) {
        const parsedDiagnosis =
          JSON.parse(storedDiagnosis);

        if (parsedDiagnosis.patientId === parsed.patientId) {
          setAssessment(
            parsedDiagnosis.assessment || ""
          );

          setDiagnoses(
            parsedDiagnosis.diagnoses?.length
              ? parsedDiagnosis.diagnoses
              : [
                  {
                    id: Date.now(),
                    type: "Primary",
                    diagnosis: "",
                    icd10: "",
                    notes: "",
                  },
                ]
          );
        }
      }
    } catch (error) {
      console.error(
        "Unable to load consultation:",
        error
      );
    }
  }, []);

  /*
   * UPDATE ASSESSMENT
   */

  const handleAssessmentChange = (event) => {
    setAssessment(event.target.value);
    setSaved(false);
  };

  /*
   * UPDATE DIAGNOSIS
   */

  const handleDiagnosisChange = (
    id,
    field,
    value
  ) => {
    setDiagnoses((previous) =>
      previous.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );

    setSaved(false);
  };

  /*
   * ADD SECONDARY DIAGNOSIS
   */

  const addDiagnosis = () => {
    setDiagnoses((previous) => [
      ...previous,
      {
        id: Date.now(),
        type: "Secondary",
        diagnosis: "",
        icd10: "",
        notes: "",
      },
    ]);

    setSaved(false);
  };

  /*
   * REMOVE DIAGNOSIS
   */

  const removeDiagnosis = (id) => {
    setDiagnoses((previous) =>
      previous.filter(
        (item) => item.id !== id
      )
    );

    setSaved(false);
  };

  /*
   * SAVE
   */

  const handleSave = () => {
    if (!consultation?.patientId) {
      return;
    }

    const diagnosisData = {
      patientId:
        consultation.patientId,

      patient:
        consultation.patient,

      assessment,

      diagnoses,

      savedAt:
        new Date().toISOString(),
    };

    localStorage.setItem(
      DIAGNOSIS_STORAGE_KEY,
      JSON.stringify(diagnosisData)
    );

    setSaved(true);
  };

  /*
   * NO CONSULTATION SELECTED
   */

  if (!consultation?.patient) {
    return (
      <div className="tenant-diagnosis-page">

        <div className="tenant-diagnosis-not-found">

          <FiUser size={42} />

          <h1>No Patient Selected</h1>

          <p>
            Please select a patient from the
            Consultation Workspace before
            opening Assessment & Diagnosis.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/tenant/clinical/consultations"
              )
            }
          >
            <FiArrowLeft />
            Back to Consultation
          </button>

        </div>

      </div>
    );
  }

  const patient =
    consultation.patient;

  const fullName =
    `${patient.firstName || ""} ${
      patient.surname || ""
    }`.trim();

  return (
    <div className="tenant-diagnosis-page">

      {/* HEADER */}

      <div className="tenant-diagnosis-header">

        <div>

          <button
            type="button"
            className="tenant-diagnosis-back"
            onClick={() =>
              navigate(
                "/tenant/clinical/consultations"
              )
            }
          >
            <FiArrowLeft />
            Back to Consultation
          </button>

          <div className="tenant-diagnosis-eyebrow">
            CLINICAL SERVICES
          </div>

          <h1>
            Assessment & Diagnosis
          </h1>

          <p>
            Record the clinician's assessment
            and diagnosis for this consultation.
          </p>

        </div>

      </div>

      {/* REAL PATIENT */}

      <section className="tenant-diagnosis-patient">

        <div className="tenant-diagnosis-avatar">

          {patient.firstName?.charAt(0)}
          {patient.surname?.charAt(0)}

        </div>

        <div className="tenant-diagnosis-patient-info">

          <span>
            SELECTED PATIENT
          </span>

          <strong>
            {fullName}
          </strong>

          <small>
            MPI:{" "}
            <strong>
              {patient.id}
            </strong>
          </small>

        </div>

        <div className="tenant-diagnosis-patient-details">

          <div>
            <FiCalendar />

            <span>
              {patient.dateOfBirth ||
                "Date of birth not recorded"}
            </span>
          </div>

          <div>
            <FiUser />

            <span>
              {patient.gender ||
                "Gender not recorded"}
            </span>
          </div>

          <div>
            <FiPhone />

            <span>
              {patient.phone ||
                "Phone not recorded"}
            </span>
          </div>

        </div>

        <div className="tenant-diagnosis-patient-status">

          <span>
            CONSULTATION
          </span>

          <strong>
            In Progress
          </strong>

        </div>

      </section>

      {/* ASSESSMENT */}

      <section className="tenant-diagnosis-card">

        <div className="tenant-diagnosis-card-header">

          <div className="tenant-diagnosis-icon">
            <FiAlertCircle />
          </div>

          <div>
            <h2>
              Clinical Assessment
            </h2>

            <p>
              Record the clinician's overall
              assessment and clinical impression.
            </p>
          </div>

        </div>

        <div className="tenant-diagnosis-field">

          <label>
            Assessment / Clinical Impression
            <span>*</span>
          </label>

          <textarea
            value={assessment}
            onChange={
              handleAssessmentChange
            }
            placeholder="Enter the clinical assessment, findings and impression..."
            rows={7}
          />

        </div>

      </section>

      {/* DIAGNOSIS */}

      <section className="tenant-diagnosis-card">

        <div className="tenant-diagnosis-card-header">

          <div className="tenant-diagnosis-icon">
            <FiCheck />
          </div>

          <div>
            <h2>
              Diagnosis
            </h2>

            <p>
              Capture the primary and
              secondary diagnoses.
            </p>
          </div>

        </div>

        <div className="tenant-diagnosis-list">

          {diagnoses.map(
            (item, index) => (

              <div
                className="tenant-diagnosis-item"
                key={item.id}
              >

                <div className="tenant-diagnosis-item-header">

                  <div>

                    <span className="tenant-diagnosis-number">
                      {index + 1}
                    </span>

                    <strong>
                      {item.type} Diagnosis
                    </strong>

                  </div>

                  {index > 0 && (
                    <button
                      type="button"
                      className="tenant-diagnosis-remove"
                      onClick={() =>
                        removeDiagnosis(
                          item.id
                        )
                      }
                    >
                      <FiTrash2 />
                      Remove
                    </button>
                  )}

                </div>

                <div className="tenant-diagnosis-grid">

                  <div className="tenant-diagnosis-field">

                    <label>
                      Diagnosis
                      <span>*</span>
                    </label>

                    <input
                      type="text"
                      value={
                        item.diagnosis
                      }
                      onChange={(event) =>
                        handleDiagnosisChange(
                          item.id,
                          "diagnosis",
                          event.target.value
                        )
                      }
                      placeholder="Enter diagnosis"
                    />

                  </div>

                  <div className="tenant-diagnosis-field">

                    <label>
                      ICD-10 Code
                    </label>

                    <input
                      type="text"
                      value={
                        item.icd10
                      }
                      onChange={(event) =>
                        handleDiagnosisChange(
                          item.id,
                          "icd10",
                          event.target.value
                        )
                      }
                      placeholder="e.g. J06.9"
                    />

                  </div>

                  <div className="tenant-diagnosis-field full">

                    <label>
                      Diagnosis Notes
                    </label>

                    <textarea
                      rows={4}
                      value={
                        item.notes
                      }
                      onChange={(event) =>
                        handleDiagnosisChange(
                          item.id,
                          "notes",
                          event.target.value
                        )
                      }
                      placeholder="Additional notes regarding this diagnosis..."
                    />

                  </div>

                </div>

              </div>
            )
          )}

        </div>

        <button
          type="button"
          className="tenant-diagnosis-add"
          onClick={addDiagnosis}
        >
          <FiPlus />
          Add Secondary Diagnosis
        </button>

      </section>

      {/* ACTIONS */}

      <div className="tenant-diagnosis-actions">

        <button
          type="button"
          className="tenant-diagnosis-cancel"
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
          className="tenant-diagnosis-save"
          onClick={handleSave}
        >
          <FiCheck />

          {saved
            ? "Assessment Saved"
            : "Save Assessment"}

        </button>

      </div>

    </div>
  );
}