import { useMemo, useState } from "react";
import {
  FaBuilding,
  FaPlus,
  FaSearch,
  FaEye,
  FaEdit,
  FaTrash,
  FaMapMarkerAlt,
  FaUsers,
  FaClinicMedical,
  FaCheckCircle,
  FaClock,
  FaTimesCircle,
  FaFilter,
} from "react-icons/fa";

const initialOrganisations = [
  {
    id: 1,
    name: "Mamelodi Health Services",
    code: "MHS-001",
    type: "Healthcare Group",
    contact: "admin@mamelodihealth.co.za",
    phone: "012 555 0100",
    location: "Mamelodi West, Pretoria",
    clinics: 8,
    staff: 126,
    status: "Active",
    created: "12 Jan 2026",
  },
  {
    id: 2,
    name: "Ulwembu Community Clinics",
    code: "UCC-002",
    type: "Clinic Network",
    contact: "admin@ulwembuclinics.co.za",
    phone: "012 555 0200",
    location: "Pretoria, Gauteng",
    clinics: 12,
    staff: 184,
    status: "Active",
    created: "28 Jan 2026",
  },
  {
    id: 3,
    name: "Pretoria Primary Care Network",
    code: "PPC-003",
    type: "Healthcare Network",
    contact: "admin@ppcn.co.za",
    phone: "012 555 0300",
    location: "Pretoria Central",
    clinics: 6,
    staff: 91,
    status: "Pending Review",
    created: "04 Feb 2026",
  },
  {
    id: 4,
    name: "Tshwane Family Health",
    code: "TFH-004",
    type: "Healthcare Group",
    contact: "admin@tshwanefamily.co.za",
    phone: "012 555 0400",
    location: "Tshwane, Gauteng",
    clinics: 5,
    staff: 73,
    status: "Active",
    created: "18 Feb 2026",
  },
  {
    id: 5,
    name: "Gauteng Community Health",
    code: "GCH-005",
    type: "Clinic Network",
    contact: "admin@gautenghealth.co.za",
    phone: "012 555 0500",
    location: "Centurion, Gauteng",
    clinics: 4,
    staff: 58,
    status: "Suspended",
    created: "02 Mar 2026",
  },
];

const statusConfig = {
  Active: {
    background: "#ecfdf5",
    color: "#047857",
    icon: FaCheckCircle,
  },
  "Pending Review": {
    background: "#fffbeb",
    color: "#b45309",
    icon: FaClock,
  },
  Suspended: {
    background: "#fef2f2",
    color: "#b91c1c",
    icon: FaTimesCircle,
  },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.Active;
  const Icon = config.icon;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 9px",
        borderRadius: "999px",
        background: config.background,
        color: config.color,
        fontSize: "10px",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={10} />
      {status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, description }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        padding: "18px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        boxShadow: "0 3px 12px rgba(15, 23, 42, 0.035)",
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "12px",
          background: "#f0fdfa",
          color: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={17} />
      </div>

      <div>
        <div
          style={{
            fontSize: "11px",
            color: "#64748b",
            marginBottom: "3px",
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: "10px",
            color: "#94a3b8",
            marginTop: "4px",
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

export default function Organisations() {
  const [organisations, setOrganisations] =
    useState(initialOrganisations);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);

  const [newOrganisation, setNewOrganisation] = useState({
    name: "",
    code: "",
    type: "Healthcare Group",
    contact: "",
    phone: "",
    location: "",
  });

  const filteredOrganisations = useMemo(() => {
    return organisations.filter((organisation) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        organisation.name.toLowerCase().includes(searchText) ||
        organisation.code.toLowerCase().includes(searchText) ||
        organisation.location.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "All" ||
        organisation.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [organisations, search, statusFilter]);

  const activeCount = organisations.filter(
    (item) => item.status === "Active"
  ).length;

  const pendingCount = organisations.filter(
    (item) => item.status === "Pending Review"
  ).length;

  const clinicCount = organisations.reduce(
    (total, item) => total + item.clinics,
    0
  );

  const handleCreate = (event) => {
    event.preventDefault();

    if (!newOrganisation.name.trim()) {
      return;
    }

    const organisation = {
      id: Date.now(),
      name: newOrganisation.name,
      code:
        newOrganisation.code ||
        `ORG-${String(organisations.length + 1).padStart(3, "0")}`,
      type: newOrganisation.type,
      contact: newOrganisation.contact || "Not provided",
      phone: newOrganisation.phone || "Not provided",
      location: newOrganisation.location || "Not provided",
      clinics: 0,
      staff: 0,
      status: "Pending Review",
      created: new Date().toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };

    setOrganisations((current) => [
      organisation,
      ...current,
    ]);

    setNewOrganisation({
      name: "",
      code: "",
      type: "Healthcare Group",
      contact: "",
      phone: "",
      location: "",
    });

    setShowModal(false);
  };

  const deleteOrganisation = (id) => {
    const organisation = organisations.find(
      (item) => item.id === id
    );

    if (!organisation) return;

    const confirmed = window.confirm(
      `Remove ${organisation.name} from the organisation list?`
    );

    if (!confirmed) return;

    setOrganisations((current) =>
      current.filter((item) => item.id !== id)
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "22px",
        paddingBottom: "32px",
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
              gap: "9px",
              marginBottom: "8px",
            }}
          >
            <FaBuilding color="#0f766e" size={14} />

            <span
              style={{
                color: "#0f766e",
                fontSize: "11px",
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Platform
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
            Organisations
          </h1>

          <p
            style={{
              margin: "7px 0 0",
              color: "#64748b",
              fontSize: "13px",
            }}
          >
            Manage healthcare organisations, facilities,
            tenants and their platform access.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
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
          <FaPlus size={11} />
          Add Organisation
        </button>
      </div>

      {/* Statistics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "14px",
        }}
      >
        <StatCard
          icon={FaBuilding}
          label="Total Organisations"
          value={organisations.length}
          description="Registered on platform"
        />

        <StatCard
          icon={FaCheckCircle}
          label="Active Organisations"
          value={activeCount}
          description="Currently operational"
        />

        <StatCard
          icon={FaClock}
          label="Pending Review"
          value={pendingCount}
          description="Require administrator review"
        />

        <StatCard
          icon={FaClinicMedical}
          label="Connected Clinics"
          value={clinicCount}
          description="Across all organisations"
        />
      </div>

      {/* Main table */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 3px 14px rgba(15,23,42,0.035)",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: "17px 18px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              position: "relative",
              flex: 1,
              minWidth: "220px",
            }}
          >
            <FaSearch
              size={12}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
              }}
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search organisations..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: "1px solid #dbe3ea",
                borderRadius: "10px",
                padding: "10px 12px 10px 32px",
                outline: "none",
                fontSize: "12px",
                color: "#334155",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              border: "1px solid #dbe3ea",
              borderRadius: "10px",
              padding: "0 10px",
              height: "37px",
            }}
          >
            <FaFilter size={11} color="#94a3b8" />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                color: "#475569",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Pending Review">
                Pending Review
              </option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            width: "100%",
            overflowX: "auto",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "950px",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                {[
                  "Organisation",
                  "Type",
                  "Location",
                  "Facilities",
                  "Staff",
                  "Status",
                  "Created",
                  "Actions",
                ].map((heading) => (
                  <th
                    key={heading}
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 800,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {filteredOrganisations.map(
                (organisation) => (
                  <tr
                    key={organisation.id}
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
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "11px",
                        }}
                      >
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            background: "#f0fdfa",
                            color: "#0f766e",
                            display: "flex",
                            alignItems: "center",
                            justifyContent:
                              "center",
                            flexShrink: 0,
                          }}
                        >
                          <FaBuilding size={14} />
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {organisation.name}
                          </div>

                          <div
                            style={{
                              fontSize: "10px",
                              color: "#94a3b8",
                              marginTop: "3px",
                            }}
                          >
                            {organisation.code}
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
                      {organisation.type}
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "11px",
                          color: "#475569",
                        }}
                      >
                        <FaMapMarkerAlt
                          size={10}
                          color="#94a3b8"
                        />

                        {organisation.location}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          fontSize: "11px",
                          color: "#475569",
                        }}
                      >
                        <FaClinicMedical
                          size={11}
                          color="#0f766e"
                        />

                        {organisation.clinics}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "7px",
                          fontSize: "11px",
                          color: "#475569",
                        }}
                      >
                        <FaUsers
                          size={11}
                          color="#64748b"
                        />

                        {organisation.staff}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <StatusBadge
                        status={organisation.status}
                      />
                    </td>

                    <td
                      style={{
                        padding: "14px",
                        fontSize: "11px",
                        color: "#64748b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {organisation.created}
                    </td>

                    <td
                      style={{
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                        }}
                      >
                        <button
                          type="button"
                          title="View organisation"
                          style={{
                            width: "30px",
                            height: "30px",
                            border:
                              "1px solid #dbe3ea",
                            borderRadius: "8px",
                            background: "#ffffff",
                            color: "#475569",
                            cursor: "pointer",
                          }}
                        >
                          <FaEye size={11} />
                        </button>

                        <button
                          type="button"
                          title="Edit organisation"
                          style={{
                            width: "30px",
                            height: "30px",
                            border:
                              "1px solid #dbe3ea",
                            borderRadius: "8px",
                            background: "#ffffff",
                            color: "#0f766e",
                            cursor: "pointer",
                          }}
                        >
                          <FaEdit size={11} />
                        </button>

                        <button
                          type="button"
                          title="Delete organisation"
                          onClick={() =>
                            deleteOrganisation(
                              organisation.id
                            )
                          }
                          style={{
                            width: "30px",
                            height: "30px",
                            border:
                              "1px solid #fee2e2",
                            borderRadius: "8px",
                            background: "#fffafa",
                            color: "#dc2626",
                            cursor: "pointer",
                          }}
                        >
                          <FaTrash size={10} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>

          {filteredOrganisations.length === 0 && (
            <div
              style={{
                padding: "55px 20px",
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              <FaBuilding
                size={28}
                style={{ marginBottom: "10px" }}
              />

              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#475569",
                }}
              >
                No organisations found
              </div>

              <div
                style={{
                  fontSize: "11px",
                  marginTop: "4px",
                }}
              >
                Try changing your search or status filter.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Create organisation modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "620px",
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
                padding: "20px",
                borderBottom:
                  "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    color: "#0f172a",
                  }}
                >
                  Add Organisation
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    fontSize: "11px",
                    color: "#94a3b8",
                  }}
                >
                  Register a new organisation on the
                  Ulwembu Healthcare platform.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  border: "none",
                  background: "#f8fafc",
                  width: "32px",
                  height: "32px",
                  borderRadius: "9px",
                  color: "#64748b",
                  cursor: "pointer",
                  fontSize: "17px",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreate}>
              <div
                style={{
                  padding: "22px",
                  display: "grid",
                  gap: "17px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "15px",
                  }}
                >
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
                      Organisation Name *
                    </label>

                    <input
                      required
                      value={newOrganisation.name}
                      onChange={(event) =>
                        setNewOrganisation(
                          (current) => ({
                            ...current,
                            name: event.target.value,
                          })
                        )
                      }
                      placeholder="e.g. Mamelodi Health Services"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px",
                        border:
                          "1px solid #dbe3ea",
                        borderRadius: "9px",
                        outline: "none",
                        fontSize: "12px",
                      }}
                    />
                  </div>

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
                      Organisation Code
                    </label>

                    <input
                      value={newOrganisation.code}
                      onChange={(event) =>
                        setNewOrganisation(
                          (current) => ({
                            ...current,
                            code: event.target.value,
                          })
                        )
                      }
                      placeholder="e.g. MHS-006"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px",
                        border:
                          "1px solid #dbe3ea",
                        borderRadius: "9px",
                        outline: "none",
                        fontSize: "12px",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "15px",
                  }}
                >
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
                      Organisation Type
                    </label>

                    <select
                      value={newOrganisation.type}
                      onChange={(event) =>
                        setNewOrganisation(
                          (current) => ({
                            ...current,
                            type: event.target.value,
                          })
                        )
                      }
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px",
                        border:
                          "1px solid #dbe3ea",
                        borderRadius: "9px",
                        outline: "none",
                        fontSize: "12px",
                        background: "#ffffff",
                      }}
                    >
                      <option>
                        Healthcare Group
                      </option>
                      <option>
                        Clinic Network
                      </option>
                      <option>
                        Healthcare Network
                      </option>
                      <option>Independent Clinic</option>
                    </select>
                  </div>

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
                      Location
                    </label>

                    <input
                      value={newOrganisation.location}
                      onChange={(event) =>
                        setNewOrganisation(
                          (current) => ({
                            ...current,
                            location:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="City, Province"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px",
                        border:
                          "1px solid #dbe3ea",
                        borderRadius: "9px",
                        outline: "none",
                        fontSize: "12px",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "15px",
                  }}
                >
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
                      Contact Email
                    </label>

                    <input
                      type="email"
                      value={newOrganisation.contact}
                      onChange={(event) =>
                        setNewOrganisation(
                          (current) => ({
                            ...current,
                            contact:
                              event.target.value,
                          })
                        )
                      }
                      placeholder="admin@organisation.co.za"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px",
                        border:
                          "1px solid #dbe3ea",
                        borderRadius: "9px",
                        outline: "none",
                        fontSize: "12px",
                      }}
                    />
                  </div>

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
                      Contact Number
                    </label>

                    <input
                      value={newOrganisation.phone}
                      onChange={(event) =>
                        setNewOrganisation(
                          (current) => ({
                            ...current,
                            phone: event.target.value,
                          })
                        )
                      }
                      placeholder="012 555 0100"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "10px",
                        border:
                          "1px solid #dbe3ea",
                        borderRadius: "9px",
                        outline: "none",
                        fontSize: "12px",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "16px 22px",
                  borderTop:
                    "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "9px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    border:
                      "1px solid #dbe3ea",
                    background: "#ffffff",
                    color: "#475569",
                    borderRadius: "9px",
                    padding: "9px 14px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={{
                    border: "none",
                    background: "#0f766e",
                    color: "#ffffff",
                    borderRadius: "9px",
                    padding: "9px 14px",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Create Organisation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}