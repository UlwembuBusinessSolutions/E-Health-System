import { useMemo, useState } from "react";
import {
  FaUserPlus,
  FaSearch,
  FaEye,
  FaEdit,
  FaIdCard,
  FaPhone,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaHeartbeat,
  FaShieldAlt,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

const initialPatients = [
  {
    id: 1,
    mpi: "MPI-2026-000001",
    firstName: "Thandi",
    lastName: "Mokoena",
    idNumber: "8504120123088",
    dateOfBirth: "1985-04-12",
    gender: "Female",
    phone: "082 456 7890",
    email: "thandi.mokoena@example.com",
    address: "Mamelodi West, Pretoria",
    medicalAid: "Discovery Health",
    medicalAidNumber: "DH458921",
    nextOfKin: "Lerato Mokoena",
    nextOfKinPhone: "083 555 1234",
    status: "Active",
    registered: "05 Aug 2026",
  },
  {
    id: 2,
    mpi: "MPI-2026-000002",
    firstName: "Sipho",
    lastName: "Dlamini",
    idNumber: "7908155123087",
    dateOfBirth: "1979-08-15",
    gender: "Male",
    phone: "079 321 4567",
    email: "sipho.dlamini@example.com",
    address: "Mamelodi East, Pretoria",
    medicalAid: "GEMS",
    medicalAidNumber: "GEMS782341",
    nextOfKin: "Nomsa Dlamini",
    nextOfKinPhone: "078 222 4455",
    status: "Active",
    registered: "06 Aug 2026",
  },
  {
    id: 3,
    mpi: "MPI-2026-000003",
    firstName: "Nomsa",
    lastName: "Mahlangu",
    idNumber: "9206230823082",
    dateOfBirth: "1992-06-23",
    gender: "Female",
    phone: "076 987 6543",
    email: "nomsa.mahlangu@example.com",
    address: "Nellmapius, Pretoria",
    medicalAid: "Bonitas",
    medicalAidNumber: "BON234981",
    nextOfKin: "Mpho Mahlangu",
    nextOfKinPhone: "072 333 7788",
    status: "Active",
    registered: "07 Aug 2026",
  },
];

const emptyPatient = {
  firstName: "",
  lastName: "",
  idNumber: "",
  passportNumber: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  alternatePhone: "",
  email: "",
  address: "",
  city: "",
  province: "Gauteng",
  postalCode: "",
  medicalAid: "",
  medicalAidNumber: "",
  nextOfKin: "",
  nextOfKinRelationship: "",
  nextOfKinPhone: "",
  emergencyContact: "",
  emergencyPhone: "",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 700,
          color: "#334155",
          marginBottom: "6px",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "#dc2626" }}> *</span>
        )}
      </label>

      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 11px",
          border: "1px solid #dbe3ea",
          borderRadius: "9px",
          outline: "none",
          fontSize: "12px",
          color: "#334155",
          background: "#ffffff",
        }}
      />
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "5px 9px",
        borderRadius: "999px",
        background: "#ecfdf5",
        color: "#047857",
        fontSize: "10px",
        fontWeight: 700,
      }}
    >
      <FaCheckCircle size={9} />
      {status}
    </span>
  );
}

function PatientDetails({ patient, onClose }) {
  if (!patient) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow:
            "0 25px 60px rgba(15,23,42,0.25)",
        }}
      >
        <div
          style={{
            padding: "20px 22px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "#0f766e",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Master Patient Index
            </div>

            <h2
              style={{
                margin: "4px 0 3px",
                color: "#0f172a",
                fontSize: "20px",
              }}
            >
              {patient.firstName} {patient.lastName}
            </h2>

            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              {patient.mpi}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: "34px",
              height: "34px",
              border: "none",
              borderRadius: "9px",
              background: "#f8fafc",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            <FaTimes size={13} />
          </button>
        </div>

        <div
          style={{
            padding: "22px",
            display: "grid",
            gap: "20px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <InfoBox
              icon={FaIdCard}
              label="MPI Number"
              value={patient.mpi}
            />

            <InfoBox
              icon={FaCalendarAlt}
              label="Date of Birth"
              value={patient.dateOfBirth}
            />

            <InfoBox
              icon={FaHeartbeat}
              label="Gender"
              value={patient.gender}
            />
          </div>

          <DetailSection title="Personal Information">
            <DetailRow
              label="ID Number"
              value={patient.idNumber}
            />
            <DetailRow
              label="Phone"
              value={patient.phone}
            />
            <DetailRow
              label="Email"
              value={patient.email || "Not provided"}
            />
            <DetailRow
              label="Address"
              value={patient.address}
            />
          </DetailSection>

          <DetailSection title="Medical Aid">
            <DetailRow
              label="Provider"
              value={patient.medicalAid || "Self-pay"}
            />
            <DetailRow
              label="Membership Number"
              value={
                patient.medicalAidNumber || "Not provided"
              }
            />
          </DetailSection>

          <DetailSection title="Next of Kin">
            <DetailRow
              label="Name"
              value={patient.nextOfKin}
            />
            <DetailRow
              label="Phone"
              value={patient.nextOfKinPhone}
            />
          </DetailSection>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "13px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: "#0f766e",
          fontSize: "10px",
          fontWeight: 700,
          marginBottom: "6px",
        }}
      >
        <Icon size={10} />
        {label}
      </div>

      <div
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div>
      <h3
        style={{
          margin: "0 0 10px",
          color: "#0f172a",
          fontSize: "13px",
        }}
      >
        {title}
      </h3>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        padding: "10px 13px",
        borderBottom: "1px solid #f1f5f9",
        fontSize: "11px",
      }}
    >
      <span style={{ color: "#64748b" }}>{label}</span>

      <span
        style={{
          color: "#334155",
          fontWeight: 600,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function Patients() {
  const [patients, setPatients] = useState(initialPatients);
  const [search, setSearch] = useState("");
  const [showRegistration, setShowRegistration] =
    useState(false);
  const [selectedPatient, setSelectedPatient] =
    useState(null);

  const [form, setForm] = useState(emptyPatient);

  const filteredPatients = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return patients;

    return patients.filter((patient) => {
      return (
        patient.mpi.toLowerCase().includes(query) ||
        patient.firstName.toLowerCase().includes(query) ||
        patient.lastName.toLowerCase().includes(query) ||
        patient.idNumber.includes(query) ||
        patient.phone.includes(query)
      );
    });
  }, [patients, search]);

  const generateMPI = () => {
    const year = new Date().getFullYear();

    const highestNumber = patients.reduce(
      (highest, patient) => {
        const match = patient.mpi.match(
          /MPI-\d{4}-(\d+)/
        );

        if (!match) return highest;

        return Math.max(
          highest,
          Number(match[1])
        );
      },
      0
    );

    return `MPI-${year}-${String(
      highestNumber + 1
    ).padStart(6, "0")}`;
  };

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleRegister = (event) => {
    event.preventDefault();

    const duplicateId = patients.some(
      (patient) =>
        form.idNumber &&
        patient.idNumber === form.idNumber
    );

    if (duplicateId) {
      window.alert(
        "A patient with this South African ID number already exists in the Master Patient Index."
      );
      return;
    }

    const newPatient = {
      id: Date.now(),
      mpi: generateMPI(),
      firstName: form.firstName,
      lastName: form.lastName,
      idNumber: form.idNumber,
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      phone: form.phone,
      email: form.email,
      address: `${form.address}, ${form.city}, ${form.province}`,
      medicalAid: form.medicalAid,
      medicalAidNumber: form.medicalAidNumber,
      nextOfKin: form.nextOfKin,
      nextOfKinPhone: form.nextOfKinPhone,
      status: "Active",
      registered: new Date().toLocaleDateString(
        "en-ZA",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      ),
    };

    setPatients((current) => [
      newPatient,
      ...current,
    ]);

    setForm(emptyPatient);
    setShowRegistration(false);

    setSelectedPatient(newPatient);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "22px",
        paddingBottom: "30px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
            }}
          >
            <FaIdCard
              size={13}
              color="#0f766e"
            />

            <span
              style={{
                color: "#0f766e",
                fontSize: "10px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Patient Management
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              color: "#0f172a",
              fontSize: "30px",
              fontWeight: 800,
            }}
          >
            Patient Registration
          </h1>

          <p
            style={{
              margin: "7px 0 0",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Register and manage patients through the
            Master Patient Index.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRegistration(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            border: "none",
            borderRadius: "11px",
            padding: "11px 15px",
            background: "#0f766e",
            color: "#ffffff",
            fontSize: "12px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FaUserPlus size={12} />
          Register Patient
        </button>
      </div>

      {/* MPI information */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "14px 16px",
          borderRadius: "14px",
          background: "#f0fdfa",
          border: "1px solid #ccfbf1",
        }}
      >
        <FaShieldAlt
          size={16}
          color="#0f766e"
          style={{ marginTop: "2px" }}
        />

        <div>
          <div
            style={{
              color: "#115e59",
              fontSize: "12px",
              fontWeight: 800,
            }}
          >
            Master Patient Index
          </div>

          <div
            style={{
              color: "#0f766e",
              fontSize: "11px",
              marginTop: "3px",
              lineHeight: 1.5,
            }}
          >
            Every registered patient receives one unique MPI
            number. This identifier remains linked to the
            patient's clinical, appointment, pharmacy and
            billing records.
          </div>
        </div>
      </div>

      {/* Patient table */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow:
            "0 3px 14px rgba(15,23,42,0.035)",
        }}
      >
        <div
          style={{
            padding: "17px 18px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "520px",
            }}
          >
            <FaSearch
              size={12}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform:
                  "translateY(-50%)",
                color: "#94a3b8",
              }}
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by MPI, name, ID number or phone..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding:
                  "10px 12px 10px 32px",
                border:
                  "1px solid #dbe3ea",
                borderRadius: "10px",
                outline: "none",
                fontSize: "12px",
              }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "1000px",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom:
                    "1px solid #e2e8f0",
                }}
              >
                {[
                  "MPI",
                  "Patient",
                  "ID Number",
                  "Date of Birth",
                  "Contact",
                  "Medical Aid",
                  "Status",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: "10px",
                      color: "#64748b",
                      fontWeight: 800,
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.04em",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredPatients.map(
                (patient) => (
                  <tr
                    key={patient.id}
                    style={{
                      borderBottom:
                        "1px solid #f1f5f9",
                    }}
                  >
                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          padding:
                            "6px 8px",
                          borderRadius:
                            "7px",
                          background:
                            "#f0fdfa",
                          color:
                            "#0f766e",
                          fontSize:
                            "10px",
                          fontWeight:
                            800,
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {patient.mpi}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius:
                              "50%",
                            background:
                              "#e6fffb",
                            color:
                              "#0f766e",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize:
                              "11px",
                            fontWeight:
                              800,
                          }}
                        >
                          {patient.firstName[0]}
                          {patient.lastName[0]}
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize:
                                "12px",
                              fontWeight:
                                700,
                              color:
                                "#0f172a",
                            }}
                          >
                            {
                              patient.firstName
                            }{" "}
                            {
                              patient.lastName
                            }
                          </div>

                          <div
                            style={{
                              fontSize:
                                "10px",
                              color:
                                "#94a3b8",
                              marginTop:
                                "2px",
                            }}
                          >
                            {
                              patient.gender
                            }
                          </div>
                        </div>
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "14px",
                        fontSize: "11px",
                        color: "#475569",
                      }}
                    >
                      {patient.idNumber}
                    </td>

                    <td
                      style={{
                        padding: "14px",
                        fontSize: "11px",
                        color: "#475569",
                      }}
                    >
                      {patient.dateOfBirth}
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: "6px",
                          fontSize:
                            "11px",
                          color:
                            "#475569",
                        }}
                      >
                        <FaPhone
                          size={9}
                          color="#94a3b8"
                        />

                        {patient.phone}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "14px",
                        fontSize: "11px",
                        color: "#475569",
                      }}
                    >
                      {patient.medicalAid ||
                        "Self-pay"}
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <StatusBadge
                        status={
                          patient.status
                        }
                      />
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          gap: "6px",
                        }}
                      >
                        <button
                          type="button"
                          title="View patient"
                          onClick={() =>
                            setSelectedPatient(
                              patient
                            )
                          }
                          style={{
                            width: "30px",
                            height: "30px",
                            border:
                              "1px solid #dbe3ea",
                            borderRadius:
                              "8px",
                            background:
                              "#ffffff",
                            color:
                              "#475569",
                            cursor:
                              "pointer",
                          }}
                        >
                          <FaEye
                            size={11}
                          />
                        </button>

                        <button
                          type="button"
                          title="Edit patient"
                          style={{
                            width: "30px",
                            height: "30px",
                            border:
                              "1px solid #dbe3ea",
                            borderRadius:
                              "8px",
                            background:
                              "#ffffff",
                            color:
                              "#0f766e",
                            cursor:
                              "pointer",
                          }}
                        >
                          <FaEdit
                            size={11}
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          {filteredPatients.length === 0 && (
            <div
              style={{
                padding: "50px 20px",
                textAlign: "center",
              }}
            >
              <FaSearch
                size={25}
                color="#cbd5e1"
              />

              <div
                style={{
                  marginTop: "10px",
                  color: "#475569",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                No patients found
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Registration modal */}
      {showRegistration && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(15,23,42,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "850px",
              maxHeight: "92vh",
              overflowY: "auto",
              background:
                "#ffffff",
              borderRadius:
                "20px",
              boxShadow:
                "0 25px 60px rgba(15,23,42,0.25)",
            }}
          >
            <div
              style={{
                padding:
                  "20px 22px",
                borderBottom:
                  "1px solid #e2e8f0",
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize:
                      "10px",
                    color:
                      "#0f766e",
                    fontWeight:
                      800,
                    letterSpacing:
                      "0.08em",
                    textTransform:
                      "uppercase",
                  }}
                >
                  Patient Management
                </div>

                <h2
                  style={{
                    margin:
                      "4px 0",
                    color:
                      "#0f172a",
                    fontSize:
                      "19px",
                  }}
                >
                  Register New Patient
                </h2>

                <p
                  style={{
                    margin: 0,
                    fontSize:
                      "11px",
                    color:
                      "#64748b",
                  }}
                >
                  A unique MPI number will
                  automatically be assigned after
                  successful registration.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowRegistration(
                    false
                  )
                }
                style={{
                  width: "34px",
                  height: "34px",
                  border:
                    "none",
                  borderRadius:
                    "9px",
                  background:
                    "#f8fafc",
                  color:
                    "#64748b",
                  cursor:
                    "pointer",
                }}
              >
                <FaTimes size={13} />
              </button>
            </div>

            <form
              onSubmit={
                handleRegister
              }
            >
              <div
                style={{
                  padding:
                    "22px",
                  display:
                    "grid",
                  gap: "22px",
                }}
              >
                <FormSection title="Personal Information">
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: "15px",
                    }}
                  >
                    <Field
                      label="First Name"
                      required
                      value={
                        form.firstName
                      }
                      onChange={(value) =>
                        updateField(
                          "firstName",
                          value
                        )
                      }
                      placeholder="First name"
                    />

                    <Field
                      label="Last Name"
                      required
                      value={
                        form.lastName
                      }
                      onChange={(value) =>
                        updateField(
                          "lastName",
                          value
                        )
                      }
                      placeholder="Surname"
                    />

                    <Field
                      label="South African ID Number"
                      required
                      value={
                        form.idNumber
                      }
                      onChange={(value) =>
                        updateField(
                          "idNumber",
                          value
                        )
                      }
                      placeholder="13-digit ID number"
                    />

                    <Field
                      label="Passport Number"
                      value={
                        form.passportNumber
                      }
                      onChange={(value) =>
                        updateField(
                          "passportNumber",
                          value
                        )
                      }
                      placeholder="For non-SA citizens"
                    />

                    <Field
                      label="Date of Birth"
                      required
                      type="date"
                      value={
                        form.dateOfBirth
                      }
                      onChange={(value) =>
                        updateField(
                          "dateOfBirth",
                          value
                        )
                      }
                    />

                    <div>
                      <label
                        style={{
                          display:
                            "block",
                          fontSize:
                            "11px",
                          fontWeight:
                            700,
                          color:
                            "#334155",
                          marginBottom:
                            "6px",
                        }}
                      >
                        Gender
                        <span
                          style={{
                            color:
                              "#dc2626",
                          }}
                        >
                          {" "}
                          *
                        </span>
                      </label>

                      <select
                        required
                        value={
                          form.gender
                        }
                        onChange={(event) =>
                          updateField(
                            "gender",
                            event
                              .target
                              .value
                          )
                        }
                        style={{
                          width:
                            "100%",
                          boxSizing:
                            "border-box",
                          padding:
                            "10px 11px",
                          border:
                            "1px solid #dbe3ea",
                          borderRadius:
                            "9px",
                          outline:
                            "none",
                          fontSize:
                            "12px",
                          background:
                            "#ffffff",
                        }}
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
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Contact Information">
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: "15px",
                    }}
                  >
                    <Field
                      label="Primary Phone"
                      required
                      value={
                        form.phone
                      }
                      onChange={(value) =>
                        updateField(
                          "phone",
                          value
                        )
                      }
                      placeholder="082 123 4567"
                    />

                    <Field
                      label="Alternative Phone"
                      value={
                        form.alternatePhone
                      }
                      onChange={(value) =>
                        updateField(
                          "alternatePhone",
                          value
                        )
                      }
                      placeholder="Optional"
                    />

                    <Field
                      label="Email Address"
                      type="email"
                      value={
                        form.email
                      }
                      onChange={(value) =>
                        updateField(
                          "email",
                          value
                        )
                      }
                      placeholder="patient@example.com"
                    />
                  </div>
                </FormSection>

                <FormSection title="Residential Address">
                  <div
                    style={{
                      display:
                        "grid",
                      gap: "15px",
                    }}
                  >
                    <Field
                      label="Street Address"
                      required
                      value={
                        form.address
                      }
                      onChange={(value) =>
                        updateField(
                          "address",
                          value
                        )
                      }
                      placeholder="Street and house number"
                    />

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "2fr 1fr 1fr",
                        gap: "15px",
                      }}
                    >
                      <Field
                        label="City / Town"
                        value={
                          form.city
                        }
                        onChange={(value) =>
                          updateField(
                            "city",
                            value
                          )
                        }
                        placeholder="Pretoria"
                      />

                      <Field
                        label="Province"
                        value={
                          form.province
                        }
                        onChange={(value) =>
                          updateField(
                            "province",
                            value
                          )
                        }
                        placeholder="Gauteng"
                      />

                      <Field
                        label="Postal Code"
                        value={
                          form.postalCode
                        }
                        onChange={(value) =>
                          updateField(
                            "postalCode",
                            value
                          )
                        }
                        placeholder="0122"
                      />
                    </div>
                  </div>
                </FormSection>

                <FormSection title="Medical Aid">
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: "15px",
                    }}
                  >
                    <Field
                      label="Medical Aid Provider"
                      value={
                        form.medicalAid
                      }
                      onChange={(value) =>
                        updateField(
                          "medicalAid",
                          value
                        )
                      }
                      placeholder="e.g. Discovery Health"
                    />

                    <Field
                      label="Membership Number"
                      value={
                        form.medicalAidNumber
                      }
                      onChange={(value) =>
                        updateField(
                          "medicalAidNumber",
                          value
                        )
                      }
                      placeholder="Membership number"
                    />
                  </div>
                </FormSection>

                <FormSection title="Next of Kin & Emergency Contact">
                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: "15px",
                    }}
                  >
                    <Field
                      label="Next of Kin"
                      required
                      value={
                        form.nextOfKin
                      }
                      onChange={(value) =>
                        updateField(
                          "nextOfKin",
                          value
                        )
                      }
                      placeholder="Full name"
                    />

                    <Field
                      label="Relationship"
                      value={
                        form.nextOfKinRelationship
                      }
                      onChange={(value) =>
                        updateField(
                          "nextOfKinRelationship",
                          value
                        )
                      }
                      placeholder="e.g. Spouse"
                    />

                    <Field
                      label="Next of Kin Phone"
                      required
                      value={
                        form.nextOfKinPhone
                      }
                      onChange={(value) =>
                        updateField(
                          "nextOfKinPhone",
                          value
                        )
                      }
                      placeholder="082 123 4567"
                    />

                    <Field
                      label="Emergency Contact"
                      value={
                        form.emergencyContact
                      }
                      onChange={(value) =>
                        updateField(
                          "emergencyContact",
                          value
                        )
                      }
                      placeholder="Full name"
                    />

                    <Field
                      label="Emergency Phone"
                      value={
                        form.emergencyPhone
                      }
                      onChange={(value) =>
                        updateField(
                          "emergencyPhone",
                          value
                        )
                      }
                      placeholder="082 123 4567"
                    />
                  </div>
                </FormSection>

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "flex-start",
                    gap: "10px",
                    padding:
                      "12px 14px",
                    borderRadius:
                      "11px",
                    background:
                      "#fffbeb",
                    border:
                      "1px solid #fde68a",
                  }}
                >
                  <FaExclamationTriangle
                    size={13}
                    color="#b45309"
                    style={{
                      marginTop:
                        "2px",
                    }}
                  />

                  <div
                    style={{
                      fontSize:
                        "10px",
                      color:
                        "#92400e",
                      lineHeight:
                        1.5,
                    }}
                  >
                    Before registration, verify that the
                    patient does not already exist in the
                    Master Patient Index. Duplicate patient
                    records can result in fragmented clinical
                    histories.
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding:
                    "15px 22px",
                  borderTop:
                    "1px solid #e2e8f0",
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: "9px",
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setForm(
                      emptyPatient
                    );
                    setShowRegistration(
                      false
                    );
                  }}
                  style={{
                    padding:
                      "10px 15px",
                    border:
                      "1px solid #dbe3ea",
                    borderRadius:
                      "9px",
                    background:
                      "#ffffff",
                    color:
                      "#475569",
                    fontSize:
                      "11px",
                    fontWeight:
                      700,
                    cursor:
                      "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: "7px",
                    padding:
                      "10px 15px",
                    border:
                      "none",
                    borderRadius:
                      "9px",
                    background:
                      "#0f766e",
                    color:
                      "#ffffff",
                    fontSize:
                      "11px",
                    fontWeight:
                      700,
                    cursor:
                      "pointer",
                  }}
                >
                  <FaUserPlus
                    size={10}
                  />
                  Register Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPatient && (
        <PatientDetails
          patient={
            selectedPatient
          }
          onClose={() =>
            setSelectedPatient(
              null
            )
          }
        />
      )}
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <section>
      <h3
        style={{
          margin: "0 0 12px",
          color: "#0f172a",
          fontSize: "13px",
        }}
      >
        {title}
      </h3>

      {children}
    </section>
  );
}
