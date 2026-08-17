import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch,
  FiUser,
  FiActivity,
  FiFileText,
  FiClipboard,
  FiPlus,
  FiTrash2,
  FiCheckCircle,
  FiArrowLeft,
  FiAlertCircle,
} from "react-icons/fi";

import { getPatients } from "../../../services/patientService";
import "../../../styles/tenant-consultations.css";

export default function Consultations() {
  const navigate = useNavigate();

  const [patients] = useState(() => getPatients());
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [form, setForm] = useState({
    chiefComplaint: "",
    clinicalNotes: "",
    assessment: "",
    temperature: "",
    bloodPressure: "",
    heartRate: "",
    respiratoryRate: "",
    oxygenSaturation: "",
    weight: "",
    diagnosis: "",
    diagnosisNotes: "",
    laboratoryTest: "",
    prescriptionMedicine: "",
    prescriptionDose: "",
    prescriptionFrequency: "",
    prescriptionDuration: "",
    referralType: "",
    referralNotes: "",
  });

  const [diagnoses, setDiagnoses] = useState([]);
  const [laboratoryRequests, setLaboratoryRequests] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [referrals, setReferrals] = useState([]);

  const [completed, setCompleted] = useState(false);

  const filteredPatients = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) {
      return patients.slice(0, 8);
    }

    return patients
      .filter((patient) => {
        const fullName =
          `${patient.firstName || ""} ${patient.surname || ""}`.toLowerCase();

        return (
          fullName.includes(value) ||
          patient.id?.toLowerCase().includes(value) ||
          patient.idNumber?.toLowerCase().includes(value) ||
          patient.phone?.toLowerCase().includes(value)
        );
      })
      .slice(0, 8);
  }, [patients, search]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const selectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearch("");
  };

  const addDiagnosis = () => {
    if (!form.diagnosis.trim()) return;

    setDiagnoses((previous) => [
      ...previous,
      {
        id: Date.now(),
        name: form.diagnosis,
        notes: form.diagnosisNotes,
      },
    ]);

    setForm((previous) => ({
      ...previous,
      diagnosis: "",
      diagnosisNotes: "",
    }));
  };

  const removeDiagnosis = (id) => {
    setDiagnoses((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const addLaboratoryRequest = () => {
    if (!form.laboratoryTest.trim()) return;

    setLaboratoryRequests((previous) => [
      ...previous,
      {
        id: Date.now(),
        test: form.laboratoryTest,
      },
    ]);

    setForm((previous) => ({
      ...previous,
      laboratoryTest: "",
    }));
  };

  const removeLaboratoryRequest = (id) => {
    setLaboratoryRequests((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const addPrescription = () => {
    if (!form.prescriptionMedicine.trim()) return;

    setPrescriptions((previous) => [
      ...previous,
      {
        id: Date.now(),
        medicine: form.prescriptionMedicine,
        dose: form.prescriptionDose,
        frequency: form.prescriptionFrequency,
        duration: form.prescriptionDuration,
      },
    ]);

    setForm((previous) => ({
      ...previous,
      prescriptionMedicine: "",
      prescriptionDose: "",
      prescriptionFrequency: "",
      prescriptionDuration: "",
    }));
  };

  const removePrescription = (id) => {
    setPrescriptions((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const addReferral = () => {
    if (!form.referralType.trim()) return;

    setReferrals((previous) => [
      ...previous,
      {
        id: Date.now(),
        type: form.referralType,
        notes: form.referralNotes,
      },
    ]);

    setForm((previous) => ({
      ...previous,
      referralType: "",
      referralNotes: "",
    }));
  };

  const removeReferral = (id) => {
    setReferrals((previous) =>
      previous.filter((item) => item.id !== id)
    );
  };

  const completeConsultation = () => {
    if (!selectedPatient) return;

    const consultation = {
      id: `CON-${Date.now()}`,
      patientId: selectedPatient.id,
      patientName: `${selectedPatient.firstName} ${selectedPatient.surname}`,
      date: new Date().toISOString(),
      chiefComplaint: form.chiefComplaint,
      clinicalNotes: form.clinicalNotes,
      assessment: form.assessment,
      vitals: {
        temperature: form.temperature,
        bloodPressure: form.bloodPressure,
        heartRate: form.heartRate,
        respiratoryRate: form.respiratoryRate,
        oxygenSaturation: form.oxygenSaturation,
        weight: form.weight,
      },
      diagnoses,
      laboratoryRequests,
      prescriptions,
      referrals,
      status: "Completed",
    };

    const existing =
      JSON.parse(
        localStorage.getItem("ulwembu_consultations") || "[]"
      );

    localStorage.setItem(
      "ulwembu_consultations",
      JSON.stringify([...existing, consultation])
    );

    setCompleted(true);
  };

  const fullName = selectedPatient
    ? `${selectedPatient.firstName || ""} ${
        selectedPatient.surname || ""
      }`.trim()
    : "";

  return (
    <div className="consultation-page">

      {/* HEADER */}

      <div className="consultation-page-header">

        <div>

          <button
            type="button"
            className="consultation-back-button"
            onClick={() =>
              navigate("/tenant/clinical")
            }
          >
            <FiArrowLeft />
            Back to Clinical Services
          </button>

          <div className="consultation-eyebrow">
            CLINICAL SERVICES
          </div>

          <h1>Consultation Workspace</h1>

          <p>
            Conduct and document a complete
            patient consultation.
          </p>

        </div>

        {selectedPatient && (
          <div className="consultation-status-badge">
            <span>CONSULTATION</span>
            <strong>In Progress</strong>
          </div>
        )}

      </div>

      {/* SUCCESS */}

      {completed && (
        <div className="consultation-success">

          <FiCheckCircle />

          <div>
            <strong>
              Consultation completed successfully
            </strong>

            <span>
              The consultation has been saved for{" "}
              {fullName}.
            </span>
          </div>

        </div>
      )}

      {/* PATIENT SEARCH */}

      <section className="consultation-card">

        <div className="consultation-card-header">

          <div className="consultation-section-icon">
            <FiUser />
          </div>

          <div>
            <h2>Select Patient</h2>

            <p>
              Search for the patient before
              starting the consultation.
            </p>
          </div>

        </div>

        <div className="consultation-search-wrapper">

          <FiSearch />

          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by patient name, MPI, ID number or phone..."
          />

        </div>

        {search && filteredPatients.length > 0 && (
          <div className="consultation-patient-results">

            {filteredPatients.map((patient) => (
              <button
                type="button"
                key={patient.id}
                className="consultation-patient-result"
                onClick={() =>
                  selectPatient(patient)
                }
              >

                <div className="consultation-result-avatar">
                  {patient.firstName?.charAt(0)}
                  {patient.surname?.charAt(0)}
                </div>

                <div>

                  <strong>
                    {patient.firstName}{" "}
                    {patient.surname}
                  </strong>

                  <span>
                    {patient.id} ·{" "}
                    {patient.phone || "No phone"}
                  </span>

                </div>

              </button>
            ))}

          </div>
        )}

      </section>

      {/* NO PATIENT */}

      {!selectedPatient && (
        <div className="consultation-empty-state">

          <FiUser />

          <h2>No Patient Selected</h2>

          <p>
            Search and select a patient above
            to open the consultation workspace.
          </p>

        </div>
      )}

      {selectedPatient && (
        <>
          {/* PATIENT DEMOGRAPHICS */}

          <section className="consultation-patient-banner">

            <div className="consultation-patient-banner-left">

              <div className="consultation-large-avatar">
                {selectedPatient.firstName?.charAt(0)}
                {selectedPatient.surname?.charAt(0)}
              </div>

              <div>

                <span className="consultation-banner-label">
                  MASTER PATIENT INDEX
                </span>

                <h2>{fullName}</h2>

                <div className="consultation-patient-meta">
                  <span>
                    MPI: <strong>{selectedPatient.id}</strong>
                  </span>

                  <span>
                    ID:{" "}
                    {selectedPatient.idNumber ||
                      "—"}
                  </span>

                  <span>
                    DOB:{" "}
                    {selectedPatient.dateOfBirth ||
                      "—"}
                  </span>

                  <span>
                    Gender:{" "}
                    {selectedPatient.gender ||
                      "—"}
                  </span>
                </div>

              </div>

            </div>

            <div className="consultation-patient-status">

              <span>STATUS</span>

              <strong>
                {selectedPatient.status ||
                  "Active"}
              </strong>

            </div>

          </section>

          {/* CHIEF COMPLAINT */}

          <section className="consultation-card">

            <div className="consultation-card-header">

              <div className="consultation-section-icon">
                <FiClipboard />
              </div>

              <div>
                <h2>Chief Complaint</h2>

                <p>
                  Record the primary reason for
                  today's consultation.
                </p>
              </div>

            </div>

            <textarea
              name="chiefComplaint"
              value={form.chiefComplaint}
              onChange={handleChange}
              className="consultation-textarea"
              placeholder="Describe the patient's main complaint..."
              rows="4"
            />

          </section>

          {/* VITALS */}

          <section className="consultation-card">

            <div className="consultation-card-header">

              <div className="consultation-section-icon">
                <FiActivity />
              </div>

              <div>
                <h2>Vital Signs</h2>

                <p>
                  Capture the patient's current
                  clinical observations.
                </p>
              </div>

            </div>

            <div className="consultation-form-grid">

              <div className="consultation-field">
                <label>Temperature (°C)</label>
                <input
                  name="temperature"
                  value={form.temperature}
                  onChange={handleChange}
                  placeholder="36.5"
                />
              </div>

              <div className="consultation-field">
                <label>Blood Pressure</label>
                <input
                  name="bloodPressure"
                  value={form.bloodPressure}
                  onChange={handleChange}
                  placeholder="120/80"
                />
              </div>

              <div className="consultation-field">
                <label>Heart Rate (bpm)</label>
                <input
                  name="heartRate"
                  value={form.heartRate}
                  onChange={handleChange}
                  placeholder="72"
                />
              </div>

              <div className="consultation-field">
                <label>Respiratory Rate</label>
                <input
                  name="respiratoryRate"
                  value={form.respiratoryRate}
                  onChange={handleChange}
                  placeholder="16"
                />
              </div>

              <div className="consultation-field">
                <label>Oxygen Saturation (%)</label>
                <input
                  name="oxygenSaturation"
                  value={form.oxygenSaturation}
                  onChange={handleChange}
                  placeholder="98"
                />
              </div>

              <div className="consultation-field">
                <label>Weight (kg)</label>
                <input
                  name="weight"
                  value={form.weight}
                  onChange={handleChange}
                  placeholder="70"
                />
              </div>

            </div>

          </section>

          {/* CLINICAL NOTES */}

          <section className="consultation-card">

            <div className="consultation-card-header">

              <div className="consultation-section-icon">
                <FiFileText />
              </div>

              <div>
                <h2>Clinical Notes & Assessment</h2>

                <p>
                  Document examination findings
                  and clinical assessment.
                </p>
              </div>

            </div>

            <div className="consultation-form-stack">

              <div className="consultation-field">

                <label>Clinical Notes</label>

                <textarea
                  name="clinicalNotes"
                  value={form.clinicalNotes}
                  onChange={handleChange}
                  className="consultation-textarea"
                  rows="6"
                  placeholder="Record clinical observations, examination findings and relevant history..."
                />

              </div>

              <div className="consultation-field">

                <label>Assessment</label>

                <textarea
                  name="assessment"
                  value={form.assessment}
                  onChange={handleChange}
                  className="consultation-textarea"
                  rows="5"
                  placeholder="Record your clinical assessment..."
                />

              </div>

            </div>

          </section>

          {/* DIAGNOSIS */}

          <section className="consultation-card">

            <div className="consultation-card-header">

              <div className="consultation-section-icon">
                <FiClipboard />
              </div>

              <div>
                <h2>Diagnosis</h2>

                <p>
                  Add one or more diagnoses to
                  the consultation.
                </p>
              </div>

            </div>

            <div className="consultation-inline-form">

              <input
                name="diagnosis"
                value={form.diagnosis}
                onChange={handleChange}
                placeholder="Enter diagnosis..."
              />

              <input
                name="diagnosisNotes"
                value={form.diagnosisNotes}
                onChange={handleChange}
                placeholder="Notes (optional)"
              />

              <button
                type="button"
                className="consultation-add-button"
                onClick={addDiagnosis}
              >
                <FiPlus />
                Add
              </button>

            </div>

            {diagnoses.length > 0 && (
              <div className="consultation-added-list">

                {diagnoses.map((item) => (
                  <div
                    className="consultation-added-item"
                    key={item.id}
                  >

                    <div>
                      <strong>{item.name}</strong>

                      {item.notes && (
                        <span>{item.notes}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeDiagnosis(item.id)
                      }
                    >
                      <FiTrash2 />
                    </button>

                  </div>
                ))}

              </div>
            )}

          </section>

          {/* LABORATORY */}

          <section className="consultation-card">

            <div className="consultation-card-header">

              <div className="consultation-section-icon">
                <FiActivity />
              </div>

              <div>
                <h2>Laboratory Requests</h2>

                <p>
                  Request laboratory investigations
                  for the patient.
                </p>
              </div>

            </div>

            <div className="consultation-inline-form">

              <input
                name="laboratoryTest"
                value={form.laboratoryTest}
                onChange={handleChange}
                placeholder="e.g. Full Blood Count"
              />

              <button
                type="button"
                className="consultation-add-button"
                onClick={addLaboratoryRequest}
              >
                <FiPlus />
                Request Test
              </button>

            </div>

            {laboratoryRequests.length > 0 && (
              <div className="consultation-added-list">

                {laboratoryRequests.map((item) => (
                  <div
                    className="consultation-added-item"
                    key={item.id}
                  >

                    <strong>{item.test}</strong>

                    <button
                      type="button"
                      onClick={() =>
                        removeLaboratoryRequest(
                          item.id
                        )
                      }
                    >
                      <FiTrash2 />
                    </button>

                  </div>
                ))}

              </div>
            )}

          </section>

          {/* PRESCRIPTION */}

          <section className="consultation-card">

            <div className="consultation-card-header">

              <div className="consultation-section-icon">
                <FiClipboard />
              </div>

              <div>
                <h2>Prescription</h2>

                <p>
                  Add medication to the patient's
                  treatment plan.
                </p>
              </div>

            </div>

            <div className="consultation-prescription-grid">

              <div className="consultation-field">
                <label>Medicine</label>
                <input
                  name="prescriptionMedicine"
                  value={form.prescriptionMedicine}
                  onChange={handleChange}
                  placeholder="Medicine name"
                />
              </div>

              <div className="consultation-field">
                <label>Dose</label>
                <input
                  name="prescriptionDose"
                  value={form.prescriptionDose}
                  onChange={handleChange}
                  placeholder="e.g. 500 mg"
                />
              </div>

              <div className="consultation-field">
                <label>Frequency</label>
                <input
                  name="prescriptionFrequency"
                  value={form.prescriptionFrequency}
                  onChange={handleChange}
                  placeholder="e.g. 3 times daily"
                />
              </div>

              <div className="consultation-field">
                <label>Duration</label>
                <input
                  name="prescriptionDuration"
                  value={form.prescriptionDuration}
                  onChange={handleChange}
                  placeholder="e.g. 5 days"
                />
              </div>

            </div>

            <button
              type="button"
              className="consultation-add-button"
              onClick={addPrescription}
            >
              <FiPlus />
              Add Medication
            </button>

            {prescriptions.length > 0 && (
              <div className="consultation-added-list">

                {prescriptions.map((item) => (
                  <div
                    className="consultation-added-item"
                    key={item.id}
                  >

                    <div>
                      <strong>{item.medicine}</strong>

                      <span>
                        {item.dose || "Dose not specified"}
                        {" · "}
                        {item.frequency ||
                          "Frequency not specified"}
                        {" · "}
                        {item.duration ||
                          "Duration not specified"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removePrescription(item.id)
                      }
                    >
                      <FiTrash2 />
                    </button>

                  </div>
                ))}

              </div>
            )}

          </section>

          {/* REFERRAL */}

          <section className="consultation-card">

            <div className="consultation-card-header">

              <div className="consultation-section-icon">
                <FiUser />
              </div>

              <div>
                <h2>Referral</h2>

                <p>
                  Refer the patient to another
                  healthcare service or specialist.
                </p>
              </div>

            </div>

            <div className="consultation-inline-form">

              <input
                name="referralType"
                value={form.referralType}
                onChange={handleChange}
                placeholder="Specialist / Service"
              />

              <input
                name="referralNotes"
                value={form.referralNotes}
                onChange={handleChange}
                placeholder="Reason for referral"
              />

              <button
                type="button"
                className="consultation-add-button"
                onClick={addReferral}
              >
                <FiPlus />
                Add Referral
              </button>

            </div>

            {referrals.length > 0 && (
              <div className="consultation-added-list">

                {referrals.map((item) => (
                  <div
                    className="consultation-added-item"
                    key={item.id}
                  >

                    <div>
                      <strong>{item.type}</strong>

                      {item.notes && (
                        <span>{item.notes}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeReferral(item.id)
                      }
                    >
                      <FiTrash2 />
                    </button>

                  </div>
                ))}

              </div>
            )}

          </section>

          {/* COMPLETE */}

          <section className="consultation-complete-card">

            <div>

              <div className="consultation-complete-icon">
                <FiCheckCircle />
              </div>

              <div>
                <h2>Complete Consultation</h2>

                <p>
                  Save this consultation to the
                  patient's clinical record.
                </p>
              </div>

            </div>

            <button
              type="button"
              className="consultation-complete-button"
              onClick={completeConsultation}
              disabled={completed}
            >
              <FiCheckCircle />

              {completed
                ? "Consultation Completed"
                : "Complete Consultation"}
            </button>

          </section>

          {!form.chiefComplaint &&
            !form.clinicalNotes &&
            !form.assessment && (
              <div className="consultation-notice">

                <FiAlertCircle />

                <span>
                  Remember to document the patient's
                  complaint, examination findings and
                  assessment before completing the
                  consultation.
                </span>

              </div>
            )}
        </>
      )}

    </div>
  );
}