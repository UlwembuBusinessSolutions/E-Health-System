import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FiArrowLeft,
  FiClock,
  FiUser,
  FiSearch,
  FiCheckCircle,
  FiActivity,
  FiAlertCircle,
  FiRefreshCw,
  FiUserPlus,
} from "react-icons/fi";

import {
  getQueue,
  updateQueueStatus,
  updateQueuePriority,
} from "../../../services/receptionService";

import "../../../styles/tenant-reception-queue.css";

export default function ReceptionQueue() {
  const navigate = useNavigate();

  const [queue, setQueue] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All");

  // ======================================================
  // LOAD QUEUE
  // ======================================================

  const loadQueue = () => {
    setQueue(getQueue());
  };

  useEffect(() => {
    loadQueue();

    const interval = setInterval(() => {
      loadQueue();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // ======================================================
  // FILTER QUEUE
  // ======================================================

  const filteredQueue = useMemo(() => {
    const searchValue =
      search.trim().toLowerCase();

    return queue.filter((item) => {
      const patient = item.patient || {};

      const fullName =
        `${patient.firstName || ""} ${
          patient.surname || ""
        }`.toLowerCase();

      const matchesSearch =
        !searchValue ||
        fullName.includes(searchValue) ||
        patient.id
          ?.toLowerCase()
          .includes(searchValue) ||
        patient.idNumber
          ?.toLowerCase()
          .includes(searchValue) ||
        patient.phone
          ?.toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        statusFilter === "All" ||
        item.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [queue, search, statusFilter]);

  // ======================================================
  // COUNTS
  // ======================================================

  const waitingCount = queue.filter(
    (item) => item.status === "Waiting"
  ).length;

  const consultationCount = queue.filter(
    (item) =>
      item.status === "In Consultation"
  ).length;

  const completedCount = queue.filter(
    (item) => item.status === "Completed"
  ).length;

  const urgentCount = queue.filter(
    (item) =>
      item.priority === "Urgent" &&
      item.status !== "Completed"
  ).length;

  // ======================================================
  // PATIENT NAME
  // ======================================================

  const getPatientName = (patient) => {
    return `${patient?.firstName || ""} ${
      patient?.surname || ""
    }`.trim() || "Unknown Patient";
  };

  // ======================================================
  // TIME
  // ======================================================

  const formatTime = (date) => {
    if (!date) {
      return "—";
    }

    return new Date(date).toLocaleTimeString(
      [],
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  };

  // ======================================================
  // WAIT TIME
  // ======================================================

  const getWaitTime = (checkedInAt) => {
    if (!checkedInAt) {
      return "—";
    }

    const difference =
      Date.now() -
      new Date(checkedInAt).getTime();

    const minutes = Math.max(
      0,
      Math.floor(difference / 60000)
    );

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes =
      minutes % 60;

    return `${hours}h ${remainingMinutes}m`;
  };

  // ======================================================
  // START CONSULTATION
  // ======================================================

  const handleStartConsultation = (
    queueItem
  ) => {
    updateQueueStatus(
      queueItem.id,
      "In Consultation"
    );

    loadQueue();

    navigate(
      `/tenant/clinical/consultations/new?patientId=${queueItem.patientId}`
    );
  };

  // ======================================================
  // COMPLETE QUEUE ENTRY
  // ======================================================

  const handleComplete = (queueItem) => {
    updateQueueStatus(
      queueItem.id,
      "Completed"
    );

    loadQueue();
  };

  // ======================================================
  // PRIORITY
  // ======================================================

  const handlePriorityChange = (
    queueItem,
    priority
  ) => {
    updateQueuePriority(
      queueItem.id,
      priority
    );

    loadQueue();
  };

  // ======================================================
  // RENDER
  // ======================================================

  return (
    <div className="reception-queue-page">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="reception-queue-header">

        <div>

          <button
            type="button"
            className="reception-back-button"
            onClick={() =>
              navigate("/tenant/patients")
            }
          >
            <FiArrowLeft />
            Back to Patients
          </button>

          <div className="tenant-page-eyebrow">
            PATIENT MANAGEMENT
          </div>

          <h1>
            Reception & Queue
          </h1>

          <p>
            Manage patient check-ins,
            waiting patients and clinical
            flow.
          </p>

        </div>

        <div className="reception-header-actions">

          <button
            type="button"
            className="reception-refresh-button"
            onClick={loadQueue}
          >
            <FiRefreshCw />
            Refresh
          </button>

          <button
            type="button"
            className="reception-walkin-button"
            onClick={() =>
              navigate(
                "/tenant/reception/walk-in"
              )
            }
          >
            <FiUserPlus />
            Walk-In Patient
          </button>

        </div>

      </div>

      {/* ==================================================
          STATISTICS
      ================================================== */}

      <div className="reception-stat-grid">

        <div className="reception-stat-card">

          <div className="reception-stat-icon">
            <FiClock />
          </div>

          <div>
            <span>
              WAITING
            </span>

            <strong>
              {waitingCount}
            </strong>
          </div>

        </div>

        <div className="reception-stat-card">

          <div className="reception-stat-icon">
            <FiActivity />
          </div>

          <div>
            <span>
              IN CONSULTATION
            </span>

            <strong>
              {consultationCount}
            </strong>
          </div>

        </div>

        <div className="reception-stat-card">

          <div className="reception-stat-icon">
            <FiCheckCircle />
          </div>

          <div>
            <span>
              COMPLETED
            </span>

            <strong>
              {completedCount}
            </strong>
          </div>

        </div>

        <div className="reception-stat-card">

          <div className="reception-stat-icon urgent">
            <FiAlertCircle />
          </div>

          <div>
            <span>
              URGENT
            </span>

            <strong>
              {urgentCount}
            </strong>
          </div>

        </div>

      </div>

      {/* ==================================================
          QUEUE CARD
      ================================================== */}

      <section className="reception-queue-card">

        <div className="reception-queue-card-header">

          <div>

            <h2>
              Today's Patient Queue
            </h2>

            <p>
              Patients currently registered
              at reception.
            </p>

          </div>

          <strong>
            {filteredQueue.length} patients
          </strong>

        </div>

        {/* ==================================================
            FILTERS
        ================================================== */}

        <div className="reception-filters">

          <div className="reception-search">

            <FiSearch />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search patient name, MPI, ID number or phone..."
            />

          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="All">
              All Statuses
            </option>

            <option value="Waiting">
              Waiting
            </option>

            <option value="In Consultation">
              In Consultation
            </option>

            <option value="Completed">
              Completed
            </option>
          </select>

        </div>

        {/* ==================================================
            EMPTY STATE
        ================================================== */}

        {filteredQueue.length === 0 ? (

          <div className="reception-empty-state">

            <FiUser size={42} />

            <h3>
              No patients in the queue
            </h3>

            <p>
              Patients checked in from
              their patient profile will
              appear here.
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/tenant/patients"
                )
              }
            >
              Go to Patient Directory
            </button>

          </div>

        ) : (

          /* ==================================================
             QUEUE TABLE
          ================================================== */

          <div className="reception-table-wrapper">

            <table className="reception-queue-table">

              <thead>

                <tr>

                  <th>
                    Queue
                  </th>

                  <th>
                    Patient
                  </th>

                  <th>
                    MPI
                  </th>

                  <th>
                    Check-In
                  </th>

                  <th>
                    Wait Time
                  </th>

                  <th>
                    Priority
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {filteredQueue.map(
                  (queueItem, index) => {

                    const patient =
                      queueItem.patient;

                    const name =
                      getPatientName(
                        patient
                      );

                    return (

                      <tr
                        key={
                          queueItem.id
                        }
                      >

                        <td>

                          <span className="queue-number">
                            #{index + 1}
                          </span>

                        </td>

                        <td>

                          <div className="reception-patient">

                            <div className="reception-avatar">

                              {patient?.firstName?.charAt(
                                0
                              )}

                              {patient?.surname?.charAt(
                                0
                              )}

                            </div>

                            <div>

                              <strong>
                                {name}
                              </strong>

                              <span>
                                {patient?.phone ||
                                  "No phone"}
                              </span>

                            </div>

                          </div>

                        </td>

                        <td>
                          <strong>
                            {patient?.id ||
                              "—"}
                          </strong>
                        </td>

                        <td>
                          {formatTime(
                            queueItem.checkedInAt
                          )}
                        </td>

                        <td>

                          <span className="wait-time">
                            <FiClock />
                            {getWaitTime(
                              queueItem.checkedInAt
                            )}
                          </span>

                        </td>

                        <td>

                          <select
                            value={
                              queueItem.priority ||
                              "Normal"
                            }
                            onChange={(
                              event
                            ) =>
                              handlePriorityChange(
                                queueItem,
                                event.target.value
                              )
                            }
                            className={`priority-select ${(
                              queueItem.priority ||
                              "Normal"
                            ).toLowerCase()}`}
                          >

                            <option value="Normal">
                              Normal
                            </option>

                            <option value="Urgent">
                              Urgent
                            </option>

                          </select>

                        </td>

                        <td>

                          <span
                            className={`queue-status ${queueItem.status
                              .toLowerCase()
                              .replace(
                                " ",
                                "-"
                              )}`}
                          >
                            {queueItem.status}
                          </span>

                        </td>

                        <td>

                          <div className="reception-actions">

                            <button
                              type="button"
                              className="view-patient-button"
                              onClick={() =>
                                navigate(
                                  `/tenant/patients/${patient.id}`
                                )
                              }
                            >
                              View
                            </button>

                            {queueItem.status ===
                              "Waiting" && (

                              <button
                                type="button"
                                className="start-consultation-button"
                                onClick={() =>
                                  handleStartConsultation(
                                    queueItem
                                  )
                                }
                              >
                                Start Consultation
                              </button>

                            )}

                            {queueItem.status ===
                              "In Consultation" && (

                              <button
                                type="button"
                                className="complete-queue-button"
                                onClick={() =>
                                  handleComplete(
                                    queueItem
                                  )
                                }
                              >
                                Complete
                              </button>

                            )}

                          </div>

                        </td>

                      </tr>

                    );
                  }
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  );
}