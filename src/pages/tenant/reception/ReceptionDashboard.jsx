import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  FiActivity,
  FiAlertCircle,
  FiArrowRight,
  FiCheckCircle,
  FiClock,
  FiMonitor,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiUserCheck,
  FiXCircle,
} from "react-icons/fi";

import {
  getTodaysQueue,
  callPatient,
  completeQueueItem,
  cancelQueueItem,
  setQueuePriority,
} from "../../../services/receptionService";

import "../../../styles/tenant-reception-dashboard.css";

export default function ReceptionDashboard() {
  const navigate = useNavigate();

  const [queue, setQueue] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("2");

  /*
  ==========================================================
  LOAD QUEUE
  ==========================================================
  */

  const loadQueue = () => {
    setQueue(getTodaysQueue());
  };

  useEffect(() => {
    loadQueue();

    const interval = setInterval(() => {
      loadQueue();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /*
  ==========================================================
  SEARCH
  ==========================================================
  */

  const filteredQueue = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return queue;
    }

    return queue.filter((item) => {
      const firstName =
        item.patient?.firstName || "";

      const surname =
        item.patient?.surname || "";

      const patientId =
        item.patient?.id || "";

      const token =
        item.tokenNumber || "";

      const fullName =
        `${firstName} ${surname}`.toLowerCase();

      return (
        fullName.includes(query) ||
        patientId.toLowerCase().includes(query) ||
        token.toLowerCase().includes(query)
      );
    });
  }, [queue, search]);

  /*
  ==========================================================
  STATISTICS
  ==========================================================
  */

  const waitingCount = queue.filter(
    (item) => item.status === "Waiting"
  ).length;

  const consultationCount = queue.filter(
    (item) => item.status === "In Consultation"
  ).length;

  const completedCount = queue.filter(
    (item) => item.status === "Completed"
  ).length;

  /*
  ==========================================================
  CURRENT PATIENT
  ==========================================================
  */

  const currentPatient = queue.find(
    (item) =>
      item.status === "In Consultation"
  );

  /*
  ==========================================================
  PATIENT NAME
  ==========================================================
  */

  const getPatientName = (item) => {
    return `${item.patient?.firstName || ""} ${
      item.patient?.surname || ""
    }`.trim();
  };

  /*
  ==========================================================
  WAITING TIME
  ==========================================================
  */

  const getWaitingMinutes = (checkInTime) => {
    if (!checkInTime) {
      return 0;
    }

    const difference =
      Date.now() -
      new Date(checkInTime).getTime();

    return Math.max(
      0,
      Math.floor(difference / 60000)
    );
  };

  /*
  ==========================================================
  FORMAT TIME
  ==========================================================
  */

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

  /*
  ==========================================================
  CALL PATIENT
  ==========================================================
  */

  const handleCallPatient = (queueId) => {
    callPatient(
      queueId,
      selectedRoom
    );

    loadQueue();
  };

  /*
  ==========================================================
  COMPLETE PATIENT
  ==========================================================
  */

  const handleComplete = (queueId) => {
    completeQueueItem(queueId);

    loadQueue();
  };

  /*
  ==========================================================
  CANCEL PATIENT
  ==========================================================
  */

  const handleCancel = (queueId) => {
    const confirmed = window.confirm(
      "Are you sure you want to remove this patient from the active queue?"
    );

    if (!confirmed) {
      return;
    }

    cancelQueueItem(queueId);

    loadQueue();
  };

  /*
  ==========================================================
  TOGGLE PRIORITY
  ==========================================================
  */

  const handlePriority = (item) => {
    const newPriority =
      item.priority === "Urgent"
        ? "Normal"
        : "Urgent";

    setQueuePriority(
      item.id,
      newPriority
    );

    loadQueue();
  };

  /*
  ==========================================================
  RENDER
  ==========================================================
  */

  return (
    <div className="reception-dashboard-page">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="reception-dashboard-header">

        <div>

          <div className="reception-page-eyebrow">
            RECEPTION & QUEUE
          </div>

          <h1>
            Reception Dashboard
          </h1>

          <p>
            Manage today's patient arrivals,
            waiting queue and consultations.
          </p>

        </div>

        <div className="reception-header-actions">

          <button
            type="button"
            className="reception-secondary-button"
            onClick={loadQueue}
          >
            <FiRefreshCw />
            Refresh
          </button>

          <button
            type="button"
            className="reception-secondary-button"
            onClick={() =>
              navigate(
                "/tenant/reception/board"
              )
            }
          >
            <FiMonitor />
            Queue Board
          </button>

          <button
            type="button"
            className="reception-primary-button"
            onClick={() =>
              navigate(
                "/tenant/reception/check-in"
              )
            }
          >
            <FiPlus />
            Check In Patient
          </button>

        </div>

      </div>

      {/* ==================================================
          STATISTICS
      ================================================== */}

      <div className="reception-stat-grid">

        <div className="reception-stat-card">

          <div className="reception-stat-icon total">
            <FiUser />
          </div>

          <div>
            <span>
              Today's Queue
            </span>

            <strong>
              {queue.length}
            </strong>
          </div>

        </div>

        <div className="reception-stat-card">

          <div className="reception-stat-icon waiting">
            <FiClock />
          </div>

          <div>
            <span>
              Waiting
            </span>

            <strong>
              {waitingCount}
            </strong>
          </div>

        </div>

        <div className="reception-stat-card">

          <div className="reception-stat-icon consultation">
            <FiActivity />
          </div>

          <div>
            <span>
              In Consultation
            </span>

            <strong>
              {consultationCount}
            </strong>
          </div>

        </div>

        <div className="reception-stat-card">

          <div className="reception-stat-icon completed">
            <FiCheckCircle />
          </div>

          <div>
            <span>
              Completed
            </span>

            <strong>
              {completedCount}
            </strong>
          </div>

        </div>

      </div>

      {/* ==================================================
          CURRENT CONSULTATION
      ================================================== */}

      {currentPatient && (

        <section className="reception-current-card">

          <div className="reception-current-left">

            <div className="reception-current-icon">
              <FiUserCheck />
            </div>

            <div>

              <span>
                CURRENTLY IN CONSULTATION
              </span>

              <h2>
                {currentPatient.tokenNumber}
              </h2>

              <strong>
                {getPatientName(
                  currentPatient
                )}
              </strong>

            </div>

          </div>

          <div className="reception-current-details">

            <div>
              <span>
                Room
              </span>

              <strong>
                {currentPatient.room || "—"}
              </strong>
            </div>

            <div>
              <span>
                Called
              </span>

              <strong>
                {formatTime(
                  currentPatient.calledAt
                )}
              </strong>
            </div>

            <button
              type="button"
              className="reception-complete-button"
              onClick={() =>
                handleComplete(
                  currentPatient.id
                )
              }
            >
              <FiCheckCircle />
              Complete Consultation
            </button>

          </div>

        </section>

      )}

      {/* ==================================================
          QUEUE MANAGEMENT
      ================================================== */}

      <section className="reception-queue-card">

        <div className="reception-queue-header">

          <div>

            <h2>
              Today's Queue
            </h2>

            <p>
              Manage patients currently registered
              at reception.
            </p>

          </div>

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
              placeholder="Search patient or token..."
            />

          </div>

        </div>

        {/* ROOM SELECTION */}

        <div className="reception-room-selector">

          <span>
            Consultation room:
          </span>

          <button
            type="button"
            className={
              selectedRoom === "1"
                ? "active"
                : ""
            }
            onClick={() =>
              setSelectedRoom("1")
            }
          >
            Room 1
          </button>

          <button
            type="button"
            className={
              selectedRoom === "2"
                ? "active"
                : ""
            }
            onClick={() =>
              setSelectedRoom("2")
            }
          >
            Room 2
          </button>

          <button
            type="button"
            className={
              selectedRoom === "3"
                ? "active"
                : ""
            }
            onClick={() =>
              setSelectedRoom("3")
            }
          >
            Room 3
          </button>

        </div>

        {/* TABLE */}

        <div className="reception-table-wrapper">

          <table className="reception-queue-table">

            <thead>

              <tr>

                <th>
                  Token
                </th>

                <th>
                  Patient
                </th>

                <th>
                  Check-in
                </th>

                <th>
                  Waiting
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

              {filteredQueue.length === 0 ? (

                <tr>

                  <td
                    colSpan="7"
                    className="reception-empty-cell"
                  >

                    <FiClock />

                    <strong>
                      No patients in the queue
                    </strong>

                    <span>
                      Patients checked in today
                      will appear here.
                    </span>

                  </td>

                </tr>

              ) : (

                filteredQueue.map(
                  (item) => (

                    <tr
                      key={item.id}
                      className={
                        item.priority ===
                        "Urgent"
                          ? "urgent-row"
                          : ""
                      }
                    >

                      {/* TOKEN */}

                      <td>

                        <span className="reception-token">
                          {item.tokenNumber}
                        </span>

                      </td>

                      {/* PATIENT */}

                      <td>

                        <div className="reception-patient">

                          <div className="reception-patient-avatar">

                            {item.patient?.firstName?.charAt(
                              0
                            )}

                            {item.patient?.surname?.charAt(
                              0
                            )}

                          </div>

                          <div>

                            <strong>
                              {getPatientName(
                                item
                              )}
                            </strong>

                            <span>
                              {item.patient?.id ||
                                "—"}
                            </span>

                          </div>

                        </div>

                      </td>

                      {/* CHECK IN */}

                      <td>
                        {formatTime(
                          item.checkInTime
                        )}
                      </td>

                      {/* WAITING */}

                      <td>

                        {item.status ===
                        "Waiting"
                          ? `${getWaitingMinutes(
                              item.checkInTime
                            )} min`
                          : "—"}

                      </td>

                      {/* PRIORITY */}

                      <td>

                        <button
                          type="button"
                          className={`reception-priority-badge ${
                            item.priority ===
                            "Urgent"
                              ? "urgent"
                              : ""
                          }`}
                          onClick={() =>
                            handlePriority(
                              item
                            )
                          }
                        >

                          {item.priority ===
                          "Urgent"
                            ? "Urgent"
                            : "Normal"}

                        </button>

                      </td>

                      {/* STATUS */}

                      <td>

                        <span
                          className={`reception-status-badge ${item.status
                            .toLowerCase()
                            .replace(
                              /\s+/g,
                              "-"
                            )}`}
                        >
                          {item.status}
                        </span>

                      </td>

                      {/* ACTIONS */}

                      <td>

                        <div className="reception-action-buttons">

                          {item.status ===
                            "Waiting" && (

                            <button
                              type="button"
                              className="reception-call-button"
                              onClick={() =>
                                handleCallPatient(
                                  item.id
                                )
                              }
                            >
                              <FiUserCheck />
                              Call
                            </button>

                          )}

                          {item.status ===
                            "In Consultation" && (

                            <button
                              type="button"
                              className="reception-complete-small-button"
                              onClick={() =>
                                handleComplete(
                                  item.id
                                )
                              }
                            >
                              <FiCheckCircle />
                              Complete
                            </button>

                          )}

                          {(item.status ===
                            "Waiting" ||
                            item.status ===
                              "In Consultation") && (

                            <button
                              type="button"
                              className="reception-cancel-button"
                              onClick={() =>
                                handleCancel(
                                  item.id
                                )
                              }
                            >
                              <FiXCircle />
                            </button>

                          )}

                          <button
                            type="button"
                            className="reception-view-button"
                            onClick={() =>
                              navigate(
                                `/tenant/patients/${item.patientId}`
                              )
                            }
                          >
                            View
                            <FiArrowRight />
                          </button>

                        </div>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}