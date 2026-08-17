import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiClock,
  FiActivity,
  FiCheckCircle,
  FiUserPlus,
  FiLogIn,
  FiList,
  FiArrowRight,
} from "react-icons/fi";

import "../../../styles/tenant-reception.css";

const QUEUE_STORAGE_KEY = "ulwembu_reception_queue";

const defaultQueue = [
  {
    id: "Q-001",
    patientName: "Thabo Mokoena",
    mpi: "MPI-000001",
    clinician: "Dr. M. Nkosi",
    service: "General Consultation",
    checkInTime: "08:15",
    status: "Waiting",
  },
  {
    id: "Q-002",
    patientName: "Lerato Mahlangu",
    mpi: "MPI-000002",
    clinician: "Dr. P. Dlamini",
    service: "Follow-up",
    checkInTime: "08:30",
    status: "With Clinician",
  },
  {
    id: "Q-003",
    patientName: "Sipho Ndlovu",
    mpi: "MPI-000003",
    clinician: "Dr. M. Nkosi",
    service: "General Consultation",
    checkInTime: "08:45",
    status: "Waiting",
  },
];

function getQueue() {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY);

    if (!stored) {
      localStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify(defaultQueue)
      );

      return defaultQueue;
    }

    return JSON.parse(stored);
  } catch {
    return defaultQueue;
  }
}

export default function ReceptionDashboard() {
  const navigate = useNavigate();

  const queue = useMemo(() => getQueue(), []);

  const waiting = queue.filter(
    (patient) => patient.status === "Waiting"
  ).length;

  const withClinician = queue.filter(
    (patient) => patient.status === "With Clinician"
  ).length;

  const completed = queue.filter(
    (patient) => patient.status === "Completed"
  ).length;

  const totalCheckedIn = queue.length;

  const stats = [
    {
      label: "Checked In",
      value: totalCheckedIn,
      icon: <FiUsers />,
      className: "",
    },
    {
      label: "Waiting",
      value: waiting,
      icon: <FiClock />,
      className: "waiting",
    },
    {
      label: "With Clinician",
      value: withClinician,
      icon: <FiActivity />,
      className: "clinical",
    },
    {
      label: "Completed",
      value: completed,
      icon: <FiCheckCircle />,
      className: "completed",
    },
  ];

  return (
    <div className="tenant-reception-page">

      {/* HEADER */}

      <div className="tenant-reception-header">

        <div>
          <div className="tenant-page-eyebrow">
            RECEPTION & QUEUE
          </div>

          <h1>Reception Dashboard</h1>

          <p>
            Manage patient check-ins, waiting queues
            and today's reception activity.
          </p>
        </div>

        <div className="tenant-reception-header-actions">

          <button
            type="button"
            className="reception-secondary-button"
            onClick={() =>
              navigate("/tenant/reception/walk-in")
            }
          >
            <FiUserPlus />
            Walk-In Patient
          </button>

          <button
            type="button"
            className="reception-primary-button"
            onClick={() =>
              navigate("/tenant/reception/check-in")
            }
          >
            <FiLogIn />
            Check In Patient
          </button>

        </div>

      </div>

      {/* STAT CARDS */}

      <div className="reception-stat-grid">

        {stats.map((stat) => (
          <div
            className="reception-stat-card"
            key={stat.label}
          >
            <div
              className={`reception-stat-icon ${stat.className}`}
            >
              {stat.icon}
            </div>

            <div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          </div>
        ))}

      </div>

      {/* MAIN CONTENT */}

      <div className="reception-content-grid">

        {/* QUEUE */}

        <section className="reception-card">

          <div className="reception-card-header">

            <div>
              <h2>Current Queue</h2>

              <p>
                Patients currently checked in today.
              </p>
            </div>

            <button
              type="button"
              className="reception-view-all"
              onClick={() =>
                navigate("/tenant/reception/board")
              }
            >
              View Queue
              <FiArrowRight />
            </button>

          </div>

          <div className="reception-queue-list">

            {queue.length === 0 ? (
              <div className="reception-empty-state">
                <FiUsers />

                <strong>
                  No patients in the queue
                </strong>

                <span>
                  Checked-in patients will appear here.
                </span>
              </div>
            ) : (
              queue.slice(0, 5).map((patient, index) => (
                <div
                  className="reception-queue-row"
                  key={patient.id}
                >

                  <div className="reception-queue-number">
                    {index + 1}
                  </div>

                  <div className="reception-patient-avatar">
                    {patient.patientName
                      ?.split(" ")
                      .map((name) => name.charAt(0))
                      .join("")
                      .slice(0, 2)}
                  </div>

                  <div className="reception-patient-info">

                    <strong>
                      {patient.patientName}
                    </strong>

                    <span>
                      {patient.mpi}
                    </span>

                  </div>

                  <div className="reception-service">

                    <strong>
                      {patient.service}
                    </strong>

                    <span>
                      {patient.clinician}
                    </span>

                  </div>

                  <div className="reception-checkin-time">

                    <span>
                      Checked in
                    </span>

                    <strong>
                      {patient.checkInTime}
                    </strong>

                  </div>

                  <div>
                    <span
                      className={`reception-status ${patient.status
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                    >
                      {patient.status}
                    </span>
                  </div>

                </div>
              ))
            )}

          </div>

        </section>

        {/* QUICK ACTIONS */}

        <section className="reception-card reception-actions-card">

          <div className="reception-card-header">

            <div>
              <h2>Quick Actions</h2>

              <p>
                Common reception tasks.
              </p>
            </div>

          </div>

          <div className="reception-action-list">

            <button
              type="button"
              onClick={() =>
                navigate("/tenant/reception/check-in")
              }
            >
              <div className="reception-action-icon">
                <FiLogIn />
              </div>

              <div>
                <strong>Check In Patient</strong>

                <span>
                  Check in a patient with an appointment.
                </span>
              </div>

              <FiArrowRight />
            </button>

            <button
              type="button"
              onClick={() =>
                navigate("/tenant/reception/walk-in")
              }
            >
              <div className="reception-action-icon">
                <FiUserPlus />
              </div>

              <div>
                <strong>Register Walk-In</strong>

                <span>
                  Add a patient without an appointment.
                </span>
              </div>

              <FiArrowRight />
            </button>

            <button
              type="button"
              onClick={() =>
                navigate("/tenant/reception/board")
              }
            >
              <div className="reception-action-icon">
                <FiList />
              </div>

              <div>
                <strong>Open Queue Board</strong>

                <span>
                  View and manage the current queue.
                </span>
              </div>

              <FiArrowRight />
            </button>

          </div>

        </section>

      </div>

      {/* RECEPTION WORKFLOW */}

      <section className="reception-card reception-workflow-card">

        <div className="reception-card-header">

          <div>
            <h2>Reception Workflow</h2>

            <p>
              Patient flow through the reception area.
            </p>
          </div>

        </div>

        <div className="reception-workflow">

          <div className="reception-workflow-step active">

            <div className="reception-workflow-number">
              1
            </div>

            <div>
              <strong>Check In</strong>
              <span>
                Confirm patient arrival.
              </span>
            </div>

          </div>

          <div className="reception-workflow-line" />

          <div className="reception-workflow-step">

            <div className="reception-workflow-number">
              2
            </div>

            <div>
              <strong>Queue</strong>
              <span>
                Patient waits for service.
              </span>
            </div>

          </div>

          <div className="reception-workflow-line" />

          <div className="reception-workflow-step">

            <div className="reception-workflow-number">
              3
            </div>

            <div>
              <strong>Clinical Service</strong>
              <span>
                Patient sees clinician.
              </span>
            </div>

          </div>

          <div className="reception-workflow-line" />

          <div className="reception-workflow-step">

            <div className="reception-workflow-number">
              4
            </div>

            <div>
              <strong>Complete</strong>
              <span>
                Visit is completed.
              </span>
            </div>

          </div>

        </div>

      </section>

    </div>
  );
}
