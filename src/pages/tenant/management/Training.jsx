import { useMemo, useState } from "react";
import {
  FaGraduationCap,
  FaUsers,
  FaCertificate,
  FaClock,
  FaSearch,
  FaPlus,
  FaBookOpen,
  FaCheckCircle,
  FaExclamationTriangle,
  FaPlayCircle,
} from "react-icons/fa";

const trainingCourses = [
  {
    id: "TRN-001",
    title: "POPIA & Patient Data Protection",
    category: "Compliance",
    duration: "2 hours",
    enrolled: 42,
    completed: 35,
    status: "Active",
    mandatory: true,
  },
  {
    id: "TRN-002",
    title: "Healthcare Information Security",
    category: "Security",
    duration: "3 hours",
    enrolled: 38,
    completed: 31,
    status: "Active",
    mandatory: true,
  },
  {
    id: "TRN-003",
    title: "Clinical Documentation Standards",
    category: "Clinical",
    duration: "2.5 hours",
    enrolled: 26,
    completed: 21,
    status: "Active",
    mandatory: true,
  },
  {
    id: "TRN-004",
    title: "Medication Safety & Dispensing",
    category: "Pharmacy",
    duration: "3 hours",
    enrolled: 18,
    completed: 15,
    status: "Active",
    mandatory: true,
  },
  {
    id: "TRN-005",
    title: "Revenue Cycle & Billing Procedures",
    category: "Finance",
    duration: "2 hours",
    enrolled: 12,
    completed: 8,
    status: "Active",
    mandatory: false,
  },
  {
    id: "TRN-006",
    title: "Workplace Health & Safety",
    category: "Safety",
    duration: "1.5 hours",
    enrolled: 45,
    completed: 43,
    status: "Active",
    mandatory: true,
  },
];

const staffProgress = [
  {
    name: "Amo Admin",
    role: "Tenant Administrator",
    completed: 6,
    total: 6,
    lastTraining: "13 Aug 2026",
    status: "Compliant",
  },
  {
    name: "Dr. Mokoena",
    role: "Clinician",
    completed: 5,
    total: 6,
    lastTraining: "11 Aug 2026",
    status: "In Progress",
  },
  {
    name: "Lerato Ndlovu",
    role: "Registered Nurse",
    completed: 6,
    total: 6,
    lastTraining: "10 Aug 2026",
    status: "Compliant",
  },
  {
    name: "Thabo Molefe",
    role: "Pharmacist",
    completed: 4,
    total: 6,
    lastTraining: "08 Aug 2026",
    status: "In Progress",
  },
  {
    name: "Naledi Maseko",
    role: "Receptionist",
    completed: 3,
    total: 6,
    lastTraining: "04 Aug 2026",
    status: "Attention Required",
  },
];

function StatCard({ icon: Icon, label, value, detail }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "18px",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        gap: "15px",
        boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
      }}
    >
      <div
        style={{
          width: "46px",
          height: "46px",
          borderRadius: "14px",
          background: "#ecfdf5",
          color: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={19} />
      </div>

      <div>
        <div
          style={{
            fontSize: "12px",
            color: "#64748b",
            marginBottom: "3px",
          }}
        >
          {label}
        </div>

        <div
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {value}
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#94a3b8",
            marginTop: "3px",
          }}
        >
          {detail}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    Compliant: {
      background: "#dcfce7",
      color: "#166534",
    },
    "In Progress": {
      background: "#fef3c7",
      color: "#92400e",
    },
    "Attention Required": {
      background: "#fee2e2",
      color: "#b91c1c",
    },
    Active: {
      background: "#dcfce7",
      color: "#166534",
    },
  };

  const style = config[status] || {
    background: "#f1f5f9",
    color: "#475569",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        padding: "5px 9px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 700,
        ...style,
      }}
    >
      {status}
    </span>
  );
}

export default function Training() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return trainingCourses.filter((course) => {
      const matchesSearch =
        !query ||
        course.title.toLowerCase().includes(query) ||
        course.category.toLowerCase().includes(query);

      const matchesCategory =
        category === "All" || course.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [search, category]);

  const totalEnrolments = trainingCourses.reduce(
    (sum, course) => sum + course.enrolled,
    0
  );

  const totalCompleted = trainingCourses.reduce(
    (sum, course) => sum + course.completed,
    0
  );

  const completionRate = Math.round(
    (totalCompleted / totalEnrolments) * 100
  );

  return (
    <div
      style={{
        display: "grid",
        gap: "24px",
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
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                background: "#ecfdf5",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FaGraduationCap />
            </div>

            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#0f766e",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Staff Development
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Training & Certification
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              color: "#64748b",
            }}
          >
            Manage healthcare staff training, mandatory courses,
            certifications and compliance requirements.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            alert("The course creation form will be connected next.")
          }
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            border: "none",
            borderRadius: "12px",
            background: "#0f766e",
            color: "#ffffff",
            padding: "11px 16px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <FaPlus />
          Create Training Course
        </button>
      </div>

      {/* Statistics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "16px",
        }}
      >
        <StatCard
          icon={FaBookOpen}
          label="Active Courses"
          value="6"
          detail="4 mandatory courses"
        />

        <StatCard
          icon={FaUsers}
          label="Staff Enrolments"
          value={totalEnrolments}
          detail="Across all courses"
        />

        <StatCard
          icon={FaCheckCircle}
          label="Completion Rate"
          value={`${completionRate}%`}
          detail="Organisation average"
        />

        <StatCard
          icon={FaCertificate}
          label="Certificates"
          value={totalCompleted}
          detail="Successfully completed"
        />
      </div>

      {/* Compliance banner */}
      <div
        style={{
          background: "#f0fdfa",
          border: "1px solid #99f6e4",
          borderRadius: "18px",
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
        }}
      >
        <FaCheckCircle
          size={22}
          color="#0f766e"
        />

        <div style={{ flex: 1 }}>
          <strong
            style={{
              display: "block",
              color: "#134e4a",
              fontSize: "14px",
            }}
          >
            Training compliance is currently {completionRate}%
          </strong>

          <span
            style={{
              color: "#0f766e",
              fontSize: "12px",
            }}
          >
            Continue monitoring mandatory courses to maintain staff
            compliance.
          </span>
        </div>

        <strong
          style={{
            color: "#0f766e",
            fontSize: "20px",
          }}
        >
          {completionRate}%
        </strong>
      </div>

      {/* Courses */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "15px",
              flexWrap: "wrap",
              marginBottom: "16px",
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
                Training Catalogue
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#94a3b8",
                  fontSize: "12px",
                }}
              >
                Courses available to healthcare staff.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: "9px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ position: "relative" }}>
                <FaSearch
                  size={12}
                  style={{
                    position: "absolute",
                    left: "11px",
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
                  placeholder="Search courses..."
                  style={{
                    width: "220px",
                    boxSizing: "border-box",
                    border: "1px solid #dbe3ea",
                    borderRadius: "10px",
                    padding: "9px 10px 9px 30px",
                    fontSize: "12px",
                    outline: "none",
                  }}
                />
              </div>

              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                style={{
                  border: "1px solid #dbe3ea",
                  borderRadius: "10px",
                  padding: "9px 10px",
                  fontSize: "12px",
                  background: "#ffffff",
                }}
              >
                <option value="All">All Categories</option>
                <option value="Compliance">Compliance</option>
                <option value="Security">Security</option>
                <option value="Clinical">Clinical</option>
                <option value="Pharmacy">Pharmacy</option>
                <option value="Finance">Finance</option>
                <option value="Safety">Safety</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: "850px",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {[
                    "Course",
                    "Category",
                    "Duration",
                    "Enrolled",
                    "Completion",
                    "Status",
                    "Action",
                  ].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        padding: "12px",
                        textAlign: "left",
                        fontSize: "11px",
                        color: "#64748b",
                        textTransform: "uppercase",
                        borderBottom:
                          "1px solid #e2e8f0",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filteredCourses.map((course) => {
                  const percentage = Math.round(
                    (course.completed / course.enrolled) *
                      100
                  );

                  return (
                    <tr key={course.id}>
                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom:
                            "1px solid #f1f5f9",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "10px",
                              background: "#f0fdfa",
                              color: "#0f766e",
                              display: "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                            }}
                          >
                            <FaBookOpen size={14} />
                          </div>

                          <div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: "#0f172a",
                                fontSize: "13px",
                              }}
                            >
                              {course.title}
                            </div>

                            {course.mandatory && (
                              <div
                                style={{
                                  color: "#b45309",
                                  fontSize: "10px",
                                  marginTop: "3px",
                                }}
                              >
                                Mandatory
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom:
                            "1px solid #f1f5f9",
                          fontSize: "12px",
                          color: "#475569",
                        }}
                      >
                        {course.category}
                      </td>

                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom:
                            "1px solid #f1f5f9",
                          fontSize: "12px",
                          color: "#475569",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <FaClock size={10} />
                          {course.duration}
                        </span>
                      </td>

                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom:
                            "1px solid #f1f5f9",
                          fontSize: "12px",
                          color: "#475569",
                        }}
                      >
                        {course.enrolled}
                      </td>

                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom:
                            "1px solid #f1f5f9",
                          minWidth: "150px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: "7px",
                              background:
                                "#e2e8f0",
                              borderRadius:
                                "999px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${percentage}%`,
                                height: "100%",
                                background:
                                  "#0f766e",
                                borderRadius:
                                  "999px",
                              }}
                            />
                          </div>

                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#475569",
                            }}
                          >
                            {percentage}%
                          </span>
                        </div>
                      </td>

                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom:
                            "1px solid #f1f5f9",
                        }}
                      >
                        <StatusBadge status={course.status} />
                      </td>

                      <td
                        style={{
                          padding: "15px 12px",
                          borderBottom:
                            "1px solid #f1f5f9",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            alert(
                              `Opening ${course.title}`
                            )
                          }
                          style={{
                            display: "inline-flex",
                            alignItems:
                              "center",
                            gap: "6px",
                            border: "none",
                            background:
                              "#f0fdfa",
                            color: "#0f766e",
                            padding:
                              "8px 10px",
                            borderRadius: "9px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <FaPlayCircle />
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Staff compliance */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              color: "#0f172a",
            }}
          >
            Staff Training Compliance
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: "12px",
              color: "#94a3b8",
            }}
          >
            Monitor individual staff training progress and
            certification status.
          </p>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              minWidth: "750px",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th
                  style={{
                    padding: "12px 20px",
                    textAlign: "left",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  Staff Member
                </th>

                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  Progress
                </th>

                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  Last Training
                </th>

                <th
                  style={{
                    padding: "12px",
                    textAlign: "left",
                    fontSize: "11px",
                    color: "#64748b",
                  }}
                >
                  Compliance
                </th>
              </tr>
            </thead>

            <tbody>
              {staffProgress.map((staff) => {
                const percentage = Math.round(
                  (staff.completed / staff.total) * 100
                );

                return (
                  <tr key={staff.name}>
                    <td
                      style={{
                        padding: "15px 20px",
                        borderTop:
                          "1px solid #f1f5f9",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "13px",
                          color: "#0f172a",
                        }}
                      >
                        {staff.name}
                      </div>

                      <div
                        style={{
                          fontSize: "11px",
                          color: "#94a3b8",
                          marginTop: "3px",
                        }}
                      >
                        {staff.role}
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        borderTop:
                          "1px solid #f1f5f9",
                        minWidth: "190px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "9px",
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            height: "7px",
                            background: "#e2e8f0",
                            borderRadius: "999px",
                          }}
                        >
                          <div
                            style={{
                              width: `${percentage}%`,
                              height: "100%",
                              background: "#0f766e",
                              borderRadius: "999px",
                            }}
                          />
                        </div>

                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {staff.completed}/{staff.total}
                        </span>
                      </div>
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        borderTop:
                          "1px solid #f1f5f9",
                        fontSize: "12px",
                        color: "#64748b",
                      }}
                    >
                      {staff.lastTraining}
                    </td>

                    <td
                      style={{
                        padding: "15px 12px",
                        borderTop:
                          "1px solid #f1f5f9",
                      }}
                    >
                      <StatusBadge status={staff.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Upcoming training */}
      <section
        style={{
          background: "#0f766e",
          borderRadius: "20px",
          padding: "22px",
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <FaGraduationCap size={30} />

        <div style={{ flex: 1 }}>
          <strong
            style={{
              display: "block",
              fontSize: "15px",
            }}
          >
            Upcoming compliance review
          </strong>

          <span
            style={{
              display: "block",
              marginTop: "5px",
              fontSize: "12px",
              opacity: 0.85,
            }}
          >
            Staff mandatory training records should be reviewed
            before the end of the current compliance period.
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            alert("Compliance review will be opened.")
          }
          style={{
            border: "1px solid rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.1)",
            color: "#ffffff",
            borderRadius: "10px",
            padding: "9px 13px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Review
        </button>
      </section>
    </div>
  );
}