import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiClock,
  FiPlus,
  FiSearch,
  FiUser,
  FiRefreshCw,
  FiEdit2,
  FiXCircle,
  FiCheckCircle,
} from "react-icons/fi";

import { getPatients } from "../../../services/patientService";
import "../../../styles/tenant-appointments.css";

const APPOINTMENTS_STORAGE_KEY = "ulwembu_appointments";

const defaultAppointments = [
  {
    id: "APT-000001",
    patientId: "MPI-000001",
    patientName: "Thabo Mokoena",
    date: "2026-08-18",
    time: "09:00",
    provider: "Dr. M. Nkosi",
    type: "General Consultation",
    reason: "Routine consultation",
    status: "Scheduled",
  },
  {
    id: "APT-000002",
    patientId: "MPI-000002",
    patientName: "Lerato Mahlangu",
    date: "2026-08-18",
    time: "10:30",
    provider: "Dr. A. Maseko",
    type: "Follow-up",
    reason: "Follow-up consultation",
    status: "Confirmed",
  },
];

function getAppointments() {
  const stored = localStorage.getItem(
    APPOINTMENTS_STORAGE_KEY
  );

  if (!stored) {
    localStorage.setItem(
      APPOINTMENTS_STORAGE_KEY,
      JSON.stringify(defaultAppointments)
    );

    return defaultAppointments;
  }

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.setItem(
      APPOINTMENTS_STORAGE_KEY,
      JSON.stringify(defaultAppointments)
    );

    return defaultAppointments;
  }
}

function saveAppointments(appointments) {
  localStorage.setItem(
    APPOINTMENTS_STORAGE_KEY,
    JSON.stringify(appointments)
  );
}

function generateAppointmentId(appointments) {
  const numbers = appointments
    .map((appointment) => {
      const match = appointment.id?.match(
        /APT-(\d+)/
      );

      return match ? Number(match[1]) : 0;
    })
    .filter(Boolean);

  const nextNumber =
    numbers.length > 0
      ? Math.max(...numbers) + 1
      : 1;

  return `APT-${String(nextNumber).padStart(
    6,
    "0"
  )}`;
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  return new Date(
    `${date}T00:00:00`
  ).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function Appointments() {
  const navigate = useNavigate();

  const [appointments, setAppointments] =
    useState([]);

  const [patients, setPatients] = useState([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [dateFilter, setDateFilter] =
    useState("All");

  const [showForm, setShowForm] =
    useState(false);

  const [form, setForm] = useState({
    patientId: "",
    date: "",
    time: "",
    provider: "",
    type: "General Consultation",
    reason: "",
  });

  const loadData = () => {
    setAppointments(getAppointments());
    setPatients(getPatients());
  };

  useEffect(() => {
    loadData();
  }, []);

  const today = new Date()
    .toISOString()
    .split("T")[0];

  const todayAppointments = appointments.filter(
    (appointment) =>
      appointment.date === today
  );

  const upcomingAppointments =
    appointments.filter(
      (appointment) =>
        appointment.date >= today &&
        appointment.status !== "Cancelled"
    );

  const completedAppointments =
    appointments.filter(
      (appointment) =>
        appointment.status === "Completed"
    );

  const cancelledAppointments =
    appointments.filter(
      (appointment) =>
        appointment.status === "Cancelled"
    );

  const filteredAppointments = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return appointments
      .filter((appointment) => {
        const matchesSearch =
          !searchValue ||
          appointment.id
            ?.toLowerCase()
            .includes(searchValue) ||
          appointment.patientName
            ?.toLowerCase()
            .includes(searchValue) ||
          appointment.patientId
            ?.toLowerCase()
            .includes(searchValue) ||
          appointment.provider
            ?.toLowerCase()
            .includes(searchValue);

        const matchesStatus =
          statusFilter === "All" ||
          appointment.status === statusFilter;

        const matchesDate =
          dateFilter === "All" ||
          (dateFilter === "Today" &&
            appointment.date === today) ||
          (dateFilter === "Upcoming" &&
            appointment.date >= today &&
            appointment.status !== "Cancelled");

        return (
          matchesSearch &&
          matchesStatus &&
          matchesDate
        );
      })
      .sort((a, b) => {
        const first = `${a.date} ${a.time}`;
        const second = `${b.date} ${b.time}`;

        return first.localeCompare(second);
      });
  }, [
    appointments,
    search,
    statusFilter,
    dateFilter,
    today,
  ]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleCreateAppointment = (event) => {
    event.preventDefault();

    if (
      !form.patientId ||
      !form.date ||
      !form.time ||
      !form.provider
    ) {
      return;
    }

    const patient = patients.find(
      (item) =>
        item.id === form.patientId
    );

    const currentAppointments =
      getAppointments();

    const newAppointment = {
      ...form,
      id: generateAppointmentId(
        currentAppointments
      ),
      patientName: patient
        ? `${patient.firstName} ${patient.surname}`
        : "Unknown Patient",
      status: "Scheduled",
    };

    const updatedAppointments = [
      ...currentAppointments,
      newAppointment,
    ];

    saveAppointments(
      updatedAppointments
    );

    setAppointments(
      updatedAppointments
    );

    setForm({
      patientId: "",
      date: "",
      time: "",
      provider: "",
      type: "General Consultation",
      reason: "",
    });

    setShowForm(false);
  };

  const updateAppointmentStatus = (
    appointmentId,
    status
  ) => {
    const updatedAppointments =
      appointments.map((appointment) =>
        appointment.id === appointmentId
          ? {
              ...appointment,
              status,
            }
          : appointment
      );

    saveAppointments(
      updatedAppointments
    );

    setAppointments(
      updatedAppointments
    );
  };

  return (
    <div className="tenant-appointments-page">

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="tenant-appointments-header">

        <div>
          <div className="tenant-appointments-eyebrow">
            PATIENT MANAGEMENT
          </div>

          <h1>Appointments</h1>

          <p>
            Schedule, manage and track patient
            appointments across the organisation.
          </p>
        </div>

        <div className="tenant-appointments-header-actions">

          <button
            type="button"
            className="appointments-refresh-button"
            onClick={loadData}
            title="Refresh appointments"
          >
            <FiRefreshCw />
          </button>

          <button
            type="button"
            className="appointments-primary-button"
            onClick={() =>
              setShowForm(true)
            }
          >
            <FiPlus />
            New Appointment
          </button>

        </div>

      </div>

      {/* ==================================================
          STAT CARDS
      ================================================== */}

      <div className="appointments-stat-grid">

        <div className="appointments-stat-card">

          <div className="appointments-stat-icon">
            <FiCalendar />
          </div>

          <div>
            <span>Total Appointments</span>
            <strong>
              {appointments.length}
            </strong>
          </div>

        </div>

        <div className="appointments-stat-card">

          <div className="appointments-stat-icon today">
            <FiClock />
          </div>

          <div>
            <span>Today's Appointments</span>
            <strong>
              {todayAppointments.length}
            </strong>
          </div>

        </div>

        <div className="appointments-stat-card">

          <div className="appointments-stat-icon upcoming">
            <FiUser />
          </div>

          <div>
            <span>Upcoming</span>
            <strong>
              {upcomingAppointments.length}
            </strong>
          </div>

        </div>

        <div className="appointments-stat-card">

          <div className="appointments-stat-icon completed">
            <FiCheckCircle />
          </div>

          <div>
            <span>Completed</span>
            <strong>
              {completedAppointments.length}
            </strong>
          </div>

        </div>

      </div>

      {/* ==================================================
          NEW APPOINTMENT FORM
      ================================================== */}

      {showForm && (
        <div className="appointment-form-card">

          <div className="appointment-form-header">

            <div>
              <div className="appointment-form-eyebrow">
                APPOINTMENT MANAGEMENT
              </div>

              <h2>New Appointment</h2>

              <p>
                Create an appointment for a
                registered patient.
              </p>
            </div>

            <button
              type="button"
              className="appointment-close-button"
              onClick={() =>
                setShowForm(false)
              }
            >
              <FiXCircle />
            </button>

          </div>

          <form
            onSubmit={
              handleCreateAppointment
            }
          >

            <div className="appointment-form-grid">

              <div className="appointment-form-field">

                <label>
                  Patient
                  <span>*</span>
                </label>

                <select
                  name="patientId"
                  value={form.patientId}
                  onChange={handleFormChange}
                  required
                >
                  <option value="">
                    Select patient
                  </option>

                  {patients.map(
                    (patient) => (
                      <option
                        key={patient.id}
                        value={patient.id}
                      >
                        {patient.firstName}{" "}
                        {patient.surname} —{" "}
                        {patient.id}
                      </option>
                    )
                  )}
                </select>

              </div>

              <div className="appointment-form-field">

                <label>
                  Date
                  <span>*</span>
                </label>

                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleFormChange}
                  required
                />

              </div>

              <div className="appointment-form-field">

                <label>
                  Time
                  <span>*</span>
                </label>

                <input
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={handleFormChange}
                  required
                />

              </div>

              <div className="appointment-form-field">

                <label>
                  Provider
                  <span>*</span>
                </label>

                <input
                  type="text"
                  name="provider"
                  value={form.provider}
                  onChange={handleFormChange}
                  placeholder="e.g. Dr. M. Nkosi"
                  required
                />

              </div>

              <div className="appointment-form-field">

                <label>
                  Appointment Type
                </label>

                <select
                  name="type"
                  value={form.type}
                  onChange={handleFormChange}
                >
                  <option>
                    General Consultation
                  </option>

                  <option>
                    Follow-up
                  </option>

                  <option>
                    Specialist Consultation
                  </option>

                  <option>
                    Chronic Care
                  </option>

                  <option>
                    Vaccination
                  </option>

                  <option>
                    Procedure
                  </option>

                  <option>
                    Laboratory
                  </option>
                </select>

              </div>

              <div className="appointment-form-field">

                <label>
                  Reason
                </label>

                <input
                  type="text"
                  name="reason"
                  value={form.reason}
                  onChange={handleFormChange}
                  placeholder="Reason for appointment"
                />

              </div>

            </div>

            <div className="appointment-form-actions">

              <button
                type="button"
                className="appointment-cancel-button"
                onClick={() =>
                  setShowForm(false)
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="appointment-save-button"
              >
                <FiCheckCircle />
                Create Appointment
              </button>

            </div>

          </form>

        </div>
      )}

      {/* ==================================================
          APPOINTMENT DIRECTORY
      ================================================== */}

      <div className="appointments-card">

        <div className="appointments-card-header">

          <div>
            <h2>Appointment Directory</h2>

            <p>
              Search and manage scheduled
              patient appointments.
            </p>
          </div>

        </div>

        {/* FILTERS */}

        <div className="appointments-filter-bar">

          <div className="appointments-search">

            <FiSearch />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search patient, MPI, appointment or provider..."
            />

          </div>

          <select
            value={dateFilter}
            onChange={(event) =>
              setDateFilter(
                event.target.value
              )
            }
            className="appointments-filter"
          >
            <option value="All">
              All dates
            </option>

            <option value="Today">
              Today
            </option>

            <option value="Upcoming">
              Upcoming
            </option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            className="appointments-filter"
          >
            <option value="All">
              All statuses
            </option>

            <option value="Scheduled">
              Scheduled
            </option>

            <option value="Confirmed">
              Confirmed
            </option>

            <option value="Completed">
              Completed
            </option>

            <option value="Cancelled">
              Cancelled
            </option>
          </select>

        </div>

        {/* TABLE */}

        <div className="appointments-table-wrapper">

          <table className="appointments-table">

            <thead>
              <tr>
                <th>Appointment</th>
                <th>Patient</th>
                <th>Date</th>
                <th>Time</th>
                <th>Provider</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filteredAppointments.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="appointments-empty"
                  >
                    <FiCalendar />

                    <strong>
                      No appointments found
                    </strong>

                    <span>
                      Try changing your filters
                      or create a new appointment.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredAppointments.map(
                  (appointment) => (
                    <tr
                      key={appointment.id}
                    >

                      <td>
                        <span className="appointment-id">
                          {appointment.id}
                        </span>
                      </td>

                      <td>
                        <div className="appointment-patient">

                          <div className="appointment-patient-avatar">
                            {appointment.patientName
                              ?.split(" ")
                              .map(
                                (name) =>
                                  name.charAt(0)
                              )
                              .slice(0, 2)
                              .join("")}
                          </div>

                          <div>
                            <strong>
                              {
                                appointment.patientName
                              }
                            </strong>

                            <span>
                              {
                                appointment.patientId
                              }
                            </span>
                          </div>

                        </div>
                      </td>

                      <td>
                        {formatDate(
                          appointment.date
                        )}
                      </td>

                      <td>
                        <span className="appointment-time">
                          <FiClock />
                          {appointment.time}
                        </span>
                      </td>

                      <td>
                        {appointment.provider}
                      </td>

                      <td>
                        {appointment.type}
                      </td>

                      <td>
                        <span
                          className={`appointment-status ${appointment.status
                            ?.toLowerCase()
                            .replace(
                              /\s+/g,
                              "-"
                            )}`}
                        >
                          {appointment.status}
                        </span>
                      </td>

                      <td>

                        <div className="appointment-actions">

                          {appointment.status !==
                            "Completed" &&
                            appointment.status !==
                              "Cancelled" && (
                              <>
                                <button
                                  type="button"
                                  className="appointment-action-button"
                                  title="Mark completed"
                                  onClick={() =>
                                    updateAppointmentStatus(
                                      appointment.id,
                                      "Completed"
                                    )
                                  }
                                >
                                  <FiCheckCircle />
                                </button>

                                <button
                                  type="button"
                                  className="appointment-action-button danger"
                                  title="Cancel appointment"
                                  onClick={() =>
                                    updateAppointmentStatus(
                                      appointment.id,
                                      "Cancelled"
                                    )
                                  }
                                >
                                  <FiXCircle />
                                </button>
                              </>
                            )}

                        </div>

                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>

        {/* FOOTER */}

        <div className="appointments-table-footer">

          Showing{" "}
          <strong>
            {filteredAppointments.length}
          </strong>{" "}
          of{" "}
          <strong>
            {appointments.length}
          </strong>{" "}
          appointments

          <span>
            Cancelled:{" "}
            <strong>
              {cancelledAppointments.length}
            </strong>
          </span>

        </div>

      </div>

    </div>
  );
}
