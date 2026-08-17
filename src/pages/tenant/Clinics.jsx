import { useMemo, useState } from "react";
import {
  FiEdit2,
  FiEye,
  FiMapPin,
  FiPlus,
  FiSearch,
  FiSettings,
  FiPower,
  FiX,
} from "react-icons/fi";

import "../../styles/tenant-clinics.css";

const initialClinics = [
  {
    id: 1,
    name: "Mamelodi West Clinic",
    code: "MWC-001",
    type: "Primary Healthcare Clinic",
    location: "Mamelodi West, Pretoria",
    phone: "012 345 6789",
    email: "mamelodi.west@mamelodi.example",
    manager: "Thabo Mahlangu",
    patients: 1248,
    status: "Active",
    modules: ["Patients", "Clinical", "Pharmacy", "Billing"],
  },
  {
    id: 2,
    name: "Mamelodi East Clinic",
    code: "MEC-002",
    type: "Primary Healthcare Clinic",
    location: "Mamelodi East, Pretoria",
    phone: "012 345 6790",
    email: "mamelodi.east@mamelodi.example",
    manager: "Lerato Dlamini",
    patients: 936,
    status: "Active",
    modules: ["Patients", "Clinical", "Pharmacy"],
  },
  {
    id: 3,
    name: "Mamelodi Community Health Centre",
    code: "MCH-003",
    type: "Community Health Centre",
    location: "Mamelodi, Pretoria",
    phone: "012 345 6791",
    email: "mchc@mamelodi.example",
    manager: "Mpho Nkosi",
    patients: 1854,
    status: "Active",
    modules: ["Patients", "Clinical", "Pharmacy", "Billing"],
  },
];

const moduleOptions = [
  "Patients",
  "Clinical",
  "Pharmacy",
  "Billing",
  "Reception",
  "Reports",
];

export default function Clinics() {
  const [clinics, setClinics] = useState(initialClinics);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showModulesModal, setShowModulesModal] = useState(false);

  const [selectedClinic, setSelectedClinic] = useState(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    type: "Primary Healthcare Clinic",
    location: "",
    phone: "",
    email: "",
    manager: "",
  });

  const filteredClinics = useMemo(() => {
    return clinics.filter((clinic) => {
      const searchValue = search.toLowerCase();

      const matchesSearch =
        clinic.name.toLowerCase().includes(searchValue) ||
        clinic.code.toLowerCase().includes(searchValue) ||
        clinic.location.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "All statuses" ||
        clinic.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clinics, search, statusFilter]);

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleAddClinic = (event) => {
    event.preventDefault();

    if (
      !form.name.trim() ||
      !form.code.trim() ||
      !form.location.trim() ||
      !form.manager.trim()
    ) {
      alert("Please complete all required fields.");
      return;
    }

    const newClinic = {
      id: Date.now(),
      name: form.name,
      code: form.code,
      type: form.type,
      location: form.location,
      phone: form.phone || "—",
      email: form.email || "—",
      manager: form.manager,
      patients: 0,
      status: "Active",
      modules: ["Patients"],
    };

    setClinics((current) => [...current, newClinic]);

    setForm({
      name: "",
      code: "",
      type: "Primary Healthcare Clinic",
      location: "",
      phone: "",
      email: "",
      manager: "",
    });

    setShowAddModal(false);
  };

  const openDetails = (clinic) => {
    setSelectedClinic(clinic);
    setShowDetailsModal(true);
  };

  const openModules = (clinic) => {
    setSelectedClinic(clinic);
    setShowModulesModal(true);
  };

  const toggleClinicStatus = (clinicId) => {
    setClinics((current) =>
      current.map((clinic) =>
        clinic.id === clinicId
          ? {
              ...clinic,
              status:
                clinic.status === "Active" ? "Suspended" : "Active",
            }
          : clinic
      )
    );
  };

  const toggleModule = (module) => {
    if (!selectedClinic) return;

    setSelectedClinic((current) => {
      const exists = current.modules.includes(module);

      return {
        ...current,
        modules: exists
          ? current.modules.filter((item) => item !== module)
          : [...current.modules, module],
      };
    });
  };

  const saveModules = () => {
    if (!selectedClinic) return;

    setClinics((current) =>
      current.map((clinic) =>
        clinic.id === selectedClinic.id
          ? {
              ...clinic,
              modules: selectedClinic.modules,
            }
          : clinic
      )
    );

    setShowModulesModal(false);
  };

  return (
    <div className="tenant-clinics-page">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="tenant-clinics-header">
        <div>
          <h1>Clinics</h1>

          <p>
            Manage clinics, locations, services and enabled modules
            for Mamelodi Health Services.
          </p>
        </div>

        <button
          type="button"
          className="clinic-primary-button"
          onClick={() => setShowAddModal(true)}
        >
          <FiPlus />
          Add clinic
        </button>
      </div>

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <div className="tenant-clinics-filters">
        <div className="clinic-search">
          <FiSearch />

          <input
            type="text"
            placeholder="Search clinics..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option>All statuses</option>
          <option>Active</option>
          <option>Suspended</option>
        </select>
      </div>

      {/* =====================================================
          SUMMARY
      ====================================================== */}

      <div className="clinic-summary-grid">
        <div className="clinic-summary-card">
          <span>Total clinics</span>
          <strong>{clinics.length}</strong>
        </div>

        <div className="clinic-summary-card">
          <span>Active clinics</span>
          <strong>
            {clinics.filter((clinic) => clinic.status === "Active").length}
          </strong>
        </div>

        <div className="clinic-summary-card">
          <span>Suspended clinics</span>
          <strong>
            {
              clinics.filter(
                (clinic) => clinic.status === "Suspended"
              ).length
            }
          </strong>
        </div>

        <div className="clinic-summary-card">
          <span>Total registered patients</span>
          <strong>
            {clinics.reduce(
              (total, clinic) => total + clinic.patients,
              0
            ).toLocaleString()}
          </strong>
        </div>
      </div>

      {/* =====================================================
          CLINICS TABLE
      ====================================================== */}

      <section className="tenant-clinics-card">
        <div className="tenant-clinics-card-header">
          <div>
            <h2>Organisation clinics</h2>

            <p>
              {filteredClinics.length} clinic
              {filteredClinics.length === 1 ? "" : "s"} displayed
            </p>
          </div>
        </div>

        <div className="tenant-clinics-table-wrapper">
          <table className="tenant-clinics-table">
            <thead>
              <tr>
                <th>CLINIC</th>
                <th>TYPE</th>
                <th>LOCATION</th>
                <th>MANAGER</th>
                <th>PATIENTS</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredClinics.length === 0 ? (
                <tr>
                  <td colSpan="7" className="clinic-empty-state">
                    <FiSearch />

                    <strong>No clinics found</strong>

                    <span>
                      Try changing your search or status filter.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredClinics.map((clinic) => (
                  <tr key={clinic.id}>
                    <td>
                      <div className="clinic-name-cell">
                        <strong>{clinic.name}</strong>

                        <span>{clinic.code}</span>
                      </div>
                    </td>

                    <td>{clinic.type}</td>

                    <td>
                      <div className="clinic-location-cell">
                        <FiMapPin />

                        <span>{clinic.location}</span>
                      </div>
                    </td>

                    <td>{clinic.manager}</td>

                    <td>
                      {clinic.patients.toLocaleString()}
                    </td>

                    <td>
                      <span
                        className={`clinic-status ${clinic.status.toLowerCase()}`}
                      >
                        {clinic.status}
                      </span>
                    </td>

                    <td>
                      <div className="clinic-actions">
                        <button
                          type="button"
                          className="clinic-row-button"
                          onClick={() => openDetails(clinic)}
                          title="View clinic"
                        >
                          <FiEye />
                          View
                        </button>

                        <button
                          type="button"
                          className="clinic-row-button"
                          onClick={() => openModules(clinic)}
                          title="Manage modules"
                        >
                          <FiSettings />
                          Modules
                        </button>

                        <button
                          type="button"
                          className="clinic-row-button danger"
                          onClick={() =>
                            toggleClinicStatus(clinic.id)
                          }
                        >
                          <FiPower />

                          {clinic.status === "Active"
                            ? "Suspend"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="tenant-clinics-footer">
          Showing {filteredClinics.length} of {clinics.length} clinics
        </div>
      </section>

      {/* =====================================================
          ADD CLINIC MODAL
      ====================================================== */}

      {showAddModal && (
        <div
          className="clinic-modal-overlay"
          onMouseDown={() => setShowAddModal(false)}
        >
          <div
            className="clinic-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="clinic-modal-header">
              <div>
                <h2>Add clinic</h2>

                <p>
                  Create a new clinic under Mamelodi Health
                  Services.
                </p>
              </div>

              <button
                type="button"
                className="clinic-close-button"
                onClick={() => setShowAddModal(false)}
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleAddClinic}>
              <div className="clinic-form-grid">
                <div className="clinic-form-group">
                  <label>
                    Clinic name <span>*</span>
                  </label>

                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    placeholder="e.g. Mamelodi North Clinic"
                  />
                </div>

                <div className="clinic-form-group">
                  <label>
                    Clinic code <span>*</span>
                  </label>

                  <input
                    name="code"
                    value={form.code}
                    onChange={handleFormChange}
                    placeholder="e.g. MNC-004"
                  />
                </div>

                <div className="clinic-form-group">
                  <label>Clinic type</label>

                  <select
                    name="type"
                    value={form.type}
                    onChange={handleFormChange}
                  >
                    <option>
                      Primary Healthcare Clinic
                    </option>

                    <option>
                      Community Health Centre
                    </option>

                    <option>Occupational Health Clinic</option>

                    <option>Specialist Clinic</option>
                  </select>
                </div>

                <div className="clinic-form-group">
                  <label>
                    Clinic manager <span>*</span>
                  </label>

                  <input
                    name="manager"
                    value={form.manager}
                    onChange={handleFormChange}
                    placeholder="Manager name"
                  />
                </div>

                <div className="clinic-form-group clinic-full-width">
                  <label>
                    Location <span>*</span>
                  </label>

                  <input
                    name="location"
                    value={form.location}
                    onChange={handleFormChange}
                    placeholder="e.g. Mamelodi North, Pretoria"
                  />
                </div>

                <div className="clinic-form-group">
                  <label>Phone number</label>

                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleFormChange}
                    placeholder="012 345 6789"
                  />
                </div>

                <div className="clinic-form-group">
                  <label>Email address</label>

                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleFormChange}
                    placeholder="clinic@mamelodi.example"
                  />
                </div>
              </div>

              <div className="clinic-modal-footer">
                <button
                  type="button"
                  className="clinic-secondary-button"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="clinic-primary-button"
                >
                  <FiPlus />
                  Create clinic
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          VIEW CLINIC MODAL
      ====================================================== */}

      {showDetailsModal && selectedClinic && (
        <div
          className="clinic-modal-overlay"
          onMouseDown={() =>
            setShowDetailsModal(false)
          }
        >
          <div
            className="clinic-modal clinic-details-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="clinic-modal-header">
              <div>
                <h2>{selectedClinic.name}</h2>

                <p>{selectedClinic.code}</p>
              </div>

              <button
                type="button"
                className="clinic-close-button"
                onClick={() =>
                  setShowDetailsModal(false)
                }
              >
                <FiX />
              </button>
            </div>

            <div className="clinic-details-grid">
              <div>
                <span>Clinic type</span>
                <strong>{selectedClinic.type}</strong>
              </div>

              <div>
                <span>Status</span>

                <strong>
                  <span
                    className={`clinic-status ${selectedClinic.status.toLowerCase()}`}
                  >
                    {selectedClinic.status}
                  </span>
                </strong>
              </div>

              <div>
                <span>Location</span>
                <strong>{selectedClinic.location}</strong>
              </div>

              <div>
                <span>Clinic manager</span>
                <strong>{selectedClinic.manager}</strong>
              </div>

              <div>
                <span>Phone</span>
                <strong>{selectedClinic.phone}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{selectedClinic.email}</strong>
              </div>

              <div>
                <span>Registered patients</span>
                <strong>
                  {selectedClinic.patients.toLocaleString()}
                </strong>
              </div>

              <div>
                <span>Enabled modules</span>

                <strong>
                  {selectedClinic.modules.length}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          MODULES MODAL
      ====================================================== */}

      {showModulesModal && selectedClinic && (
        <div
          className="clinic-modal-overlay"
          onMouseDown={() =>
            setShowModulesModal(false)
          }
        >
          <div
            className="clinic-modal modules-modal"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="clinic-modal-header">
              <div>
                <h2>Clinic modules</h2>

                <p>{selectedClinic.name}</p>
              </div>

              <button
                type="button"
                className="clinic-close-button"
                onClick={() =>
                  setShowModulesModal(false)
                }
              >
                <FiX />
              </button>
            </div>

            <div className="clinic-modules-list">
              {moduleOptions.map((module) => {
                const enabled =
                  selectedClinic.modules.includes(module);

                return (
                  <label
                    key={module}
                    className="clinic-module-item"
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() =>
                        toggleModule(module)
                      }
                    />

                    <div>
                      <strong>{module}</strong>

                      <span>
                        Enable the {module.toLowerCase()} module
                        for this clinic.
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="clinic-modal-footer">
              <button
                type="button"
                className="clinic-secondary-button"
                onClick={() =>
                  setShowModulesModal(false)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="clinic-primary-button"
                onClick={saveModules}
              >
                Save modules
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
