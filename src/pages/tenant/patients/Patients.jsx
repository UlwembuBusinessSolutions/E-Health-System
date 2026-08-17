import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiSearch,
  FiUser,
  FiEye,
  FiRefreshCw,
} from "react-icons/fi";

import { getPatients } from "../../../services/patientService";
import "../../../styles/tenant-patients.css";

export default function Patients() {
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const loadPatients = () => {
    setPatients(getPatients());
  };

  useEffect(() => {
    loadPatients();

    const handleStorageChange = () => {
      loadPatients();
    };

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorageChange
      );
    };
  }, []);

  const filteredPatients = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch =
        !searchValue ||
        patient.id
          ?.toLowerCase()
          .includes(searchValue) ||
        patient.firstName
          ?.toLowerCase()
          .includes(searchValue) ||
        patient.surname
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
        patient.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    patients,
    search,
    statusFilter,
  ]);

  const activePatients = patients.filter(
    (patient) =>
      patient.status === "Active"
  ).length;

  const inactivePatients = patients.filter(
    (patient) =>
      patient.status !== "Active"
  ).length;

  return (
    <div className="tenant-patients-page">

      {/* HEADER */}

      <div className="tenant-patients-header">

        <div>
          <div className="tenant-page-eyebrow">
            PATIENT MANAGEMENT
          </div>

          <h1>Patients</h1>

          <p>
            Manage patient records and access
            their healthcare information.
          </p>
        </div>

        <button
          type="button"
          className="patients-primary-button"
          onClick={() =>
            navigate(
              "/tenant/patients/register"
            )
          }
        >
          <FiPlus />
          Register Patient
        </button>

      </div>

      {/* STAT CARDS */}

      <div className="patients-stat-grid">

        <div className="patients-stat-card">
          <div className="patients-stat-icon">
            <FiUser />
          </div>

          <div>
            <span>Total Patients</span>
            <strong>{patients.length}</strong>
          </div>
        </div>

        <div className="patients-stat-card">
          <div className="patients-stat-icon active">
            <FiUser />
          </div>

          <div>
            <span>Active Patients</span>
            <strong>{activePatients}</strong>
          </div>
        </div>

        <div className="patients-stat-card">
          <div className="patients-stat-icon inactive">
            <FiUser />
          </div>

          <div>
            <span>Inactive</span>
            <strong>{inactivePatients}</strong>
          </div>
        </div>

      </div>

      {/* PATIENT TABLE */}

      <div className="patients-card">

        <div className="patients-card-header">

          <div>
            <h2>Patient Directory</h2>

            <p>
              Search and manage registered patients.
            </p>
          </div>

          <button
            type="button"
            className="patients-refresh-button"
            onClick={loadPatients}
            title="Refresh"
          >
            <FiRefreshCw />
          </button>

        </div>

        {/* FILTER BAR */}

        <div className="patients-filter-bar">

          <div className="patients-search">

            <FiSearch />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search by patient name, MPI, ID number or phone..."
            />

          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
            className="patients-status-filter"
          >
            <option value="All">
              All statuses
            </option>

            <option value="Active">
              Active
            </option>

            <option value="Inactive">
              Inactive
            </option>
          </select>

        </div>

        {/* TABLE */}

        <div className="patients-table-wrapper">

          <table className="patients-table">

            <thead>
              <tr>
                <th>MPI</th>
                <th>Patient</th>
                <th>ID Number</th>
                <th>Date of Birth</th>
                <th>Gender</th>
                <th>Contact</th>
                <th>Medical Aid</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>

              {filteredPatients.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="patients-empty"
                  >
                    <FiUser />

                    <strong>
                      No patients found
                    </strong>

                    <span>
                      Try changing your search
                      or register a new patient.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredPatients.map(
                  (patient) => (
                    <tr
                      key={patient.id}
                    >

                      <td>
                        <span className="patient-mpi">
                          {patient.id}
                        </span>
                      </td>

                      <td>
                        <div className="patient-name-cell">

                          <div className="patient-avatar">
                            {patient.firstName
                              ?.charAt(0)}
                            {patient.surname
                              ?.charAt(0)}
                          </div>

                          <div>
                            <strong>
                              {patient.firstName}{" "}
                              {patient.surname}
                            </strong>

                            {patient.preferredName && (
                              <span>
                                {patient.preferredName}
                              </span>
                            )}
                          </div>

                        </div>
                      </td>

                      <td>
                        {patient.idNumber ||
                          "—"}
                      </td>

                      <td>
                        {patient.dateOfBirth ||
                          "—"}
                      </td>

                      <td>
                        {patient.gender ||
                          "—"}
                      </td>

                      <td>
                        {patient.phone ||
                          "—"}
                      </td>

                      <td>
                        {patient.medicalAid ||
                          "None"}
                      </td>

                      <td>
                        <span
                          className={`patient-status ${
                            patient.status
                              ?.toLowerCase()
                          }`}
                        >
                          {patient.status}
                        </span>
                      </td>

                      <td>

                        <button
                          type="button"
                          className="patient-view-button"
                          onClick={() =>
                            navigate(
                              `/tenant/patients/${patient.id}`
                            )
                          }
                        >
                          <FiEye />
                          View
                        </button>

                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>

        {/* FOOTER */}

        <div className="patients-table-footer">

          Showing{" "}
          <strong>
            {filteredPatients.length}
          </strong>{" "}
          of{" "}
          <strong>
            {patients.length}
          </strong>{" "}
          patients

        </div>

      </div>

    </div>
  );
}