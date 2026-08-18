import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCheck,
  FiUser,
  FiPhone,
  FiMapPin,
  FiHeart,
  FiShield,
  FiActivity,
  FiFileText,
} from "react-icons/fi";

import { createPatient } from "../../../services/patientService";
import "../../../styles/tenant-patient-registration.css";

export default function PatientRegistration() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    firstName: "",
    surname: "",
    preferredName: "",
    idNumber: "",
    dateOfBirth: "",
    gender: "",

    phone: "",
    email: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",

    medicalAid: "",
    medicalAidNumber: "",
    medicalAidPlan: "",

    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",

    allergies: "",
    chronicConditions: "",
    currentMedication: "",
    medicalHistory: "",

    privacyConsent: false,
    treatmentConsent: false,
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    if (!form.surname.trim()) {
      newErrors.surname = "Surname is required";
    }

    if (!form.idNumber.trim()) {
      newErrors.idNumber = "ID number is required";
    }

    if (!form.dateOfBirth) {
      newErrors.dateOfBirth = "Date of birth is required";
    }

    if (!form.gender) {
      newErrors.gender = "Gender is required";
    }

    if (!form.phone.trim()) {
      newErrors.phone = "Phone number is required";
    }

    if (!form.privacyConsent) {
      newErrors.privacyConsent =
        "Privacy consent is required";
    }

    if (!form.treatmentConsent) {
      newErrors.treatmentConsent =
        "Treatment consent is required";
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    const patient = createPatient(form);

    setSuccess(true);

    setTimeout(() => {
      navigate(`/tenant/patients/${patient.id}`);
    }, 800);
  };

  const inputClass = (field) =>
    errors[field]
      ? "patient-form-input error"
      : "patient-form-input";

  return (
    <div className="patient-registration-page">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="patient-registration-header">

        <button
          type="button"
          className="patient-back-button"
          onClick={() => navigate("/tenant/patients")}
        >
          <FiArrowLeft />
          Back to Patients
        </button>

        <div>
          <div className="patient-page-eyebrow">
            PATIENT MANAGEMENT
          </div>

          <h1>Register Patient</h1>

          <p>
            Create a new patient record and generate
            a unique medical patient identifier.
          </p>
        </div>

      </div>

      {/* ==================================================
          SUCCESS
      ================================================== */}

      {success && (
        <div className="patient-success-message">
          <FiCheck />

          <div>
            <strong>
              Patient registered successfully
            </strong>

            <span>
              Opening the patient profile...
            </span>
          </div>
        </div>
      )}

      <form
        className="patient-registration-form"
        onSubmit={handleSubmit}
      >

        {/* ==================================================
            PERSONAL INFORMATION
        ================================================== */}

        <section className="patient-form-card">

          <div className="patient-form-card-header">

            <div className="patient-form-section-icon">
              <FiUser />
            </div>

            <div>
              <h2>Personal Information</h2>

              <p>
                Basic demographic information for
                the patient.
              </p>
            </div>

          </div>

          <div className="patient-form-grid">

            <div className="patient-form-field">

              <label>
                First Name
                <span>*</span>
              </label>

              <input
                type="text"
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                className={inputClass("firstName")}
                placeholder="Enter first name"
              />

              {errors.firstName && (
                <small>{errors.firstName}</small>
              )}

            </div>

            <div className="patient-form-field">

              <label>
                Surname
                <span>*</span>
              </label>

              <input
                type="text"
                name="surname"
                value={form.surname}
                onChange={handleChange}
                className={inputClass("surname")}
                placeholder="Enter surname"
              />

              {errors.surname && (
                <small>{errors.surname}</small>
              )}

            </div>

            <div className="patient-form-field">

              <label>
                Preferred Name
              </label>

              <input
                type="text"
                name="preferredName"
                value={form.preferredName}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="Optional"
              />

            </div>

            <div className="patient-form-field">

              <label>
                South African ID Number
                <span>*</span>
              </label>

              <input
                type="text"
                name="idNumber"
                value={form.idNumber}
                onChange={handleChange}
                className={inputClass("idNumber")}
                placeholder="13 digit ID number"
                maxLength={13}
              />

              {errors.idNumber && (
                <small>{errors.idNumber}</small>
              )}

            </div>

            <div className="patient-form-field">

              <label>
                Date of Birth
                <span>*</span>
              </label>

              <input
                type="date"
                name="dateOfBirth"
                value={form.dateOfBirth}
                onChange={handleChange}
                className={inputClass("dateOfBirth")}
              />

              {errors.dateOfBirth && (
                <small>{errors.dateOfBirth}</small>
              )}

            </div>

            <div className="patient-form-field">

              <label>
                Gender
                <span>*</span>
              </label>

              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className={inputClass("gender")}
              >
                <option value="">
                  Select gender
                </option>

                <option value="Female">
                  Female
                </option>

                <option value="Male">
                  Male
                </option>

                <option value="Other">
                  Other
                </option>

                <option value="Prefer not to say">
                  Prefer not to say
                </option>
              </select>

              {errors.gender && (
                <small>{errors.gender}</small>
              )}

            </div>

          </div>

        </section>

        {/* ==================================================
            CONTACT INFORMATION
        ================================================== */}

        <section className="patient-form-card">

          <div className="patient-form-card-header">

            <div className="patient-form-section-icon">
              <FiPhone />
            </div>

            <div>
              <h2>Contact Information</h2>

              <p>
                Patient contact and residential
                information.
              </p>
            </div>

          </div>

          <div className="patient-form-grid">

            <div className="patient-form-field">

              <label>
                Mobile Number
                <span>*</span>
              </label>

              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                className={inputClass("phone")}
                placeholder="e.g. 082 123 4567"
              />

              {errors.phone && (
                <small>{errors.phone}</small>
              )}

            </div>

            <div className="patient-form-field">

              <label>
                Email Address
              </label>

              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="patient@email.com"
              />

            </div>

            <div className="patient-form-field full">

              <label>
                Street Address
              </label>

              <div className="patient-input-with-icon">
                <FiMapPin />

                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  className="patient-form-input"
                  placeholder="Street address"
                />
              </div>

            </div>

            <div className="patient-form-field">

              <label>
                City
              </label>

              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="City"
              />

            </div>

            <div className="patient-form-field">

              <label>
                Province
              </label>

              <select
                name="province"
                value={form.province}
                onChange={handleChange}
                className="patient-form-input"
              >
                <option value="">
                  Select province
                </option>

                <option value="Gauteng">
                  Gauteng
                </option>

                <option value="Western Cape">
                  Western Cape
                </option>

                <option value="KwaZulu-Natal">
                  KwaZulu-Natal
                </option>

                <option value="Eastern Cape">
                  Eastern Cape
                </option>

                <option value="Free State">
                  Free State
                </option>

                <option value="Limpopo">
                  Limpopo
                </option>

                <option value="Mpumalanga">
                  Mpumalanga
                </option>

                <option value="North West">
                  North West
                </option>

                <option value="Northern Cape">
                  Northern Cape
                </option>
              </select>

            </div>

            <div className="patient-form-field">

              <label>
                Postal Code
              </label>

              <input
                type="text"
                name="postalCode"
                value={form.postalCode}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="Postal code"
              />

            </div>

          </div>

        </section>

        {/* ==================================================
            MEDICAL AID
        ================================================== */}

        <section className="patient-form-card">

          <div className="patient-form-card-header">

            <div className="patient-form-section-icon">
              <FiShield />
            </div>

            <div>
              <h2>Medical Aid</h2>

              <p>
                Medical aid and insurance information.
              </p>
            </div>

          </div>

          <div className="patient-form-grid">

            <div className="patient-form-field">

              <label>
                Medical Aid Provider
              </label>

              <input
                type="text"
                name="medicalAid"
                value={form.medicalAid}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="e.g. Discovery Health"
              />

            </div>

            <div className="patient-form-field">

              <label>
                Medical Aid Number
              </label>

              <input
                type="text"
                name="medicalAidNumber"
                value={form.medicalAidNumber}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="Membership number"
              />

            </div>

            <div className="patient-form-field">

              <label>
                Medical Aid Plan
              </label>

              <input
                type="text"
                name="medicalAidPlan"
                value={form.medicalAidPlan}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="Plan name"
              />

            </div>

          </div>

        </section>

        {/* ==================================================
            EMERGENCY CONTACT
        ================================================== */}

        <section className="patient-form-card">

          <div className="patient-form-card-header">

            <div className="patient-form-section-icon">
              <FiHeart />
            </div>

            <div>
              <h2>Emergency Contact</h2>

              <p>
                Person to contact in case of an
                emergency.
              </p>
            </div>

          </div>

          <div className="patient-form-grid">

            <div className="patient-form-field">

              <label>
                Full Name
              </label>

              <input
                type="text"
                name="emergencyContactName"
                value={form.emergencyContactName}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="Emergency contact"
              />

            </div>

            <div className="patient-form-field">

              <label>
                Phone Number
              </label>

              <input
                type="tel"
                name="emergencyContactPhone"
                value={form.emergencyContactPhone}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="Contact number"
              />

            </div>

            <div className="patient-form-field">

              <label>
                Relationship
              </label>

              <select
                name="emergencyContactRelationship"
                value={form.emergencyContactRelationship}
                onChange={handleChange}
                className="patient-form-input"
              >
                <option value="">
                  Select relationship
                </option>

                <option value="Parent">
                  Parent
                </option>

                <option value="Spouse">
                  Spouse
                </option>

                <option value="Sibling">
                  Sibling
                </option>

                <option value="Child">
                  Child
                </option>

                <option value="Relative">
                  Relative
                </option>

                <option value="Friend">
                  Friend
                </option>

                <option value="Other">
                  Other
                </option>
              </select>

            </div>

          </div>

        </section>

        {/* ==================================================
            CLINICAL INFORMATION
        ================================================== */}

        <section className="patient-form-card">

          <div className="patient-form-card-header">

            <div className="patient-form-section-icon">
              <FiActivity />
            </div>

            <div>
              <h2>Clinical Information</h2>

              <p>
                Important clinical information that
                should be available to healthcare
                professionals.
              </p>
            </div>

          </div>

          <div className="patient-form-grid">

            {/* ALLERGIES */}

            <div className="patient-form-field full">

              <label>
                Known Allergies
              </label>

              <textarea
                name="allergies"
                value={form.allergies}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="List any known medication, food or other allergies. Enter 'None known' if applicable."
                rows="4"
              />

            </div>

            {/* CHRONIC CONDITIONS */}

            <div className="patient-form-field full">

              <label>
                Chronic Conditions
              </label>

              <textarea
                name="chronicConditions"
                value={form.chronicConditions}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="e.g. Diabetes, hypertension, asthma, epilepsy..."
                rows="4"
              />

            </div>

            {/* CURRENT MEDICATION */}

            <div className="patient-form-field full">

              <label>
                Current Medication
              </label>

              <textarea
                name="currentMedication"
                value={form.currentMedication}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="List current medication, dosage and frequency where known."
                rows="4"
              />

            </div>

            {/* MEDICAL HISTORY */}

            <div className="patient-form-field full">

              <label>
                Previous Medical History
              </label>

              <textarea
                name="medicalHistory"
                value={form.medicalHistory}
                onChange={handleChange}
                className="patient-form-input"
                placeholder="Record relevant previous illnesses, surgeries, hospitalisations or other medical history."
                rows="5"
              />

            </div>

          </div>

        </section>

        {/* ==================================================
            CONSENT
        ================================================== */}

        <section className="patient-form-card">

          <div className="patient-form-card-header">

            <div className="patient-form-section-icon">
              <FiFileText />
            </div>

            <div>
              <h2>Consent & Privacy</h2>

              <p>
                Confirm the patient's consent before
                completing registration.
              </p>
            </div>

          </div>

          <div className="patient-consent-section">

            {/* PRIVACY CONSENT */}

            <label className="patient-consent-item">

              <input
                type="checkbox"
                name="privacyConsent"
                checked={form.privacyConsent}
                onChange={handleChange}
              />

              <span>
                I confirm that the patient has been
                informed about the collection and use
                of their personal and healthcare
                information in accordance with the
                organisation's privacy requirements.
                <strong> *</strong>
              </span>

            </label>

            {errors.privacyConsent && (
              <small className="patient-consent-error">
                {errors.privacyConsent}
              </small>
            )}

            {/* TREATMENT CONSENT */}

            <label className="patient-consent-item">

              <input
                type="checkbox"
                name="treatmentConsent"
                checked={form.treatmentConsent}
                onChange={handleChange}
              />

              <span>
                I confirm that the patient has provided
                the required consent to receive healthcare
                services from this organisation.
                <strong> *</strong>
              </span>

            </label>

            {errors.treatmentConsent && (
              <small className="patient-consent-error">
                {errors.treatmentConsent}
              </small>
            )}

          </div>

        </section>

        {/* ==================================================
            FORM ACTIONS
        ================================================== */}

        <div className="patient-form-actions">

          <button
            type="button"
            className="patient-cancel-button"
            onClick={() => navigate("/tenant/patients")}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="patient-submit-button"
            disabled={success}
          >
            <FiCheck />

            {success
              ? "Registered"
              : "Register Patient"}
          </button>

        </div>

      </form>

    </div>
  );
}
