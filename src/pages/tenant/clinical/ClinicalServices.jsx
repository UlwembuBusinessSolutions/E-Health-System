import { useMemo, useState } from "react";
import {
  FiActivity,
  FiEdit2,
  FiPlus,
  FiSearch,
  FiToggleLeft,
  FiToggleRight,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import "../../../styles/tenant-clinical-services.css";

const DEFAULT_SERVICES = [
  {
    id: "CS-001",
    name: "General Consultation",
    category: "Consultation",
    code: "CONS-001",
    description: "Routine general medical consultation.",
    duration: 30,
    fee: 450,
    status: "Active",
  },
  {
    id: "CS-002",
    name: "Follow-up Consultation",
    category: "Consultation",
    code: "CONS-002",
    description: "Follow-up consultation for an existing condition.",
    duration: 20,
    fee: 300,
    status: "Active",
  },
  {
    id: "CS-003",
    name: "Blood Pressure Check",
    category: "Screening",
    code: "SCR-001",
    description: "Blood pressure screening and assessment.",
    duration: 10,
    fee: 100,
    status: "Active",
  },
  {
    id: "CS-004",
    name: "Diabetes Screening",
    category: "Screening",
    code: "SCR-002",
    description: "Basic diabetes screening and glucose assessment.",
    duration: 15,
    fee: 180,
    status: "Active",
  },
  {
    id: "CS-005",
    name: "Minor Wound Care",
    category: "Treatment",
    code: "TRT-001",
    description: "Assessment and treatment of minor wounds.",
    duration: 30,
    fee: 250,
    status: "Active",
  },
  {
    id: "CS-006",
    name: "Health Assessment",
    category: "Assessment",
    code: "ASM-001",
    description: "Comprehensive general health assessment.",
    duration: 45,
    fee: 600,
    status: "Inactive",
  },
];

const STORAGE_KEY = "ulwembu_clinical_services";

function loadServices() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(DEFAULT_SERVICES)
    );

    return DEFAULT_SERVICES;
  }

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(DEFAULT_SERVICES)
    );

    return DEFAULT_SERVICES;
  }
}

function saveServices(services) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(services)
  );
}

export default function ClinicalServices() {
  const [services, setServices] = useState(loadServices);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [form, setForm] = useState({
    name: "",
    category: "Consultation",
    code: "",
    description: "",
    duration: "30",
    fee: "",
    status: "Active",
  });

  const categories = useMemo(() => {
    return [
      "All",
      ...new Set(services.map((service) => service.category)),
    ];
  }, [services]);

  const filteredServices = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return services.filter((service) => {
      const matchesSearch =
        !searchValue ||
        service.name?.toLowerCase().includes(searchValue) ||
        service.code?.toLowerCase().includes(searchValue) ||
        service.category?.toLowerCase().includes(searchValue);

      const matchesCategory =
        category === "All" ||
        service.category === category;

      const matchesStatus =
        status === "All" ||
        service.status === status;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesStatus
      );
    });
  }, [services, search, category, status]);

  const activeCount = services.filter(
    (service) => service.status === "Active"
  ).length;

  const inactiveCount = services.filter(
    (service) => service.status === "Inactive"
  ).length;

  const totalCategories = new Set(
    services.map((service) => service.category)
  ).size;

  const openCreateModal = () => {
    setEditingService(null);

    setForm({
      name: "",
      category: "Consultation",
      code: "",
      description: "",
      duration: "30",
      fee: "",
      status: "Active",
    });

    setShowModal(true);
  };

  const openEditModal = (service) => {
    setEditingService(service);

    setForm({
      name: service.name || "",
      category: service.category || "Consultation",
      code: service.code || "",
      description: service.description || "",
      duration: String(service.duration || 30),
      fee: String(service.fee || ""),
      status: service.status || "Active",
    });

    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingService(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.code.trim()) {
      return;
    }

    if (editingService) {
      const updated = services.map((service) =>
        service.id === editingService.id
          ? {
              ...service,
              ...form,
              duration: Number(form.duration),
              fee: Number(form.fee || 0),
            }
          : service
      );

      setServices(updated);
      saveServices(updated);
    } else {
      const newService = {
        id: `CS-${String(services.length + 1).padStart(3, "0")}`,
        ...form,
        duration: Number(form.duration),
        fee: Number(form.fee || 0),
      };

      const updated = [...services, newService];

      setServices(updated);
      saveServices(updated);
    }

    closeModal();
  };

  const toggleStatus = (serviceId) => {
    const updated = services.map((service) =>
      service.id === serviceId
        ? {
            ...service,
            status:
              service.status === "Active"
                ? "Inactive"
                : "Active",
          }
        : service
    );

    setServices(updated);
    saveServices(updated);
  };

  const deleteService = (serviceId) => {
    const service = services.find(
      (item) => item.id === serviceId
    );

    if (!service) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${service.name}"?`
    );

    if (!confirmed) {
      return;
    }

    const updated = services.filter(
      (item) => item.id !== serviceId
    );

    setServices(updated);
    saveServices(updated);
  };

  return (
    <div className="clinical-services-page">

      {/* HEADER */}

      <div className="clinical-services-header">

        <div>
          <div className="clinical-services-eyebrow">
            CLINICAL SERVICES
          </div>

          <h1>Clinical Services</h1>

          <p>
            Configure and manage the healthcare
            services available at your organisation.
          </p>
        </div>

        <button
          type="button"
          className="clinical-services-primary-button"
          onClick={openCreateModal}
        >
          <FiPlus />
          Add Service
        </button>

      </div>

      {/* STAT CARDS */}

      <div className="clinical-services-stat-grid">

        <div className="clinical-services-stat-card">
          <div className="clinical-services-stat-icon">
            <FiActivity />
          </div>

          <div>
            <span>Total Services</span>
            <strong>{services.length}</strong>
          </div>
        </div>

        <div className="clinical-services-stat-card">
          <div className="clinical-services-stat-icon active">
            <FiToggleRight />
          </div>

          <div>
            <span>Active Services</span>
            <strong>{activeCount}</strong>
          </div>
        </div>

        <div className="clinical-services-stat-card">
          <div className="clinical-services-stat-icon categories">
            <FiActivity />
          </div>

          <div>
            <span>Categories</span>
            <strong>{totalCategories}</strong>
          </div>
        </div>

        <div className="clinical-services-stat-card">
          <div className="clinical-services-stat-icon inactive">
            <FiToggleLeft />
          </div>

          <div>
            <span>Inactive</span>
            <strong>{inactiveCount}</strong>
          </div>
        </div>

      </div>

      {/* DIRECTORY */}

      <section className="clinical-services-card">

        <div className="clinical-services-card-header">

          <div>
            <h2>Service Directory</h2>

            <p>
              Search, configure and manage clinical
              services offered by the organisation.
            </p>
          </div>

        </div>

        {/* FILTERS */}

        <div className="clinical-services-filter-bar">

          <div className="clinical-services-search">
            <FiSearch />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search services, codes or categories..."
            />
          </div>

          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value)
            }
            className="clinical-services-filter"
          >
            {categories.map((item) => (
              <option
                value={item}
                key={item}
              >
                {item === "All"
                  ? "All categories"
                  : item}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            className="clinical-services-filter"
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

        <div className="clinical-services-table-wrapper">

          <table className="clinical-services-table">

            <thead>
              <tr>
                <th>Code</th>
                <th>Service</th>
                <th>Category</th>
                <th>Duration</th>
                <th>Fee</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filteredServices.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="clinical-services-empty"
                  >
                    <FiActivity />

                    <strong>
                      No clinical services found
                    </strong>

                    <span>
                      Try changing your filters or
                      add a new service.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr key={service.id}>

                    <td>
                      <span className="clinical-service-code">
                        {service.code}
                      </span>
                    </td>

                    <td>
                      <div className="clinical-service-name">
                        <strong>
                          {service.name}
                        </strong>

                        <span>
                          {service.description}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="clinical-service-category">
                        {service.category}
                      </span>
                    </td>

                    <td>
                      {service.duration} min
                    </td>

                    <td>
                      <strong>
                        R{" "}
                        {Number(service.fee || 0).toLocaleString(
                          "en-ZA",
                          {
                            minimumFractionDigits: 2,
                          }
                        )}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`clinical-service-status ${
                          service.status.toLowerCase()
                        }`}
                      >
                        {service.status}
                      </span>
                    </td>

                    <td>
                      <div className="clinical-service-actions">

                        <button
                          type="button"
                          title="Edit service"
                          onClick={() =>
                            openEditModal(service)
                          }
                        >
                          <FiEdit2 />
                        </button>

                        <button
                          type="button"
                          title={
                            service.status === "Active"
                              ? "Deactivate service"
                              : "Activate service"
                          }
                          onClick={() =>
                            toggleStatus(service.id)
                          }
                        >
                          {service.status === "Active" ? (
                            <FiToggleRight />
                          ) : (
                            <FiToggleLeft />
                          )}
                        </button>

                        <button
                          type="button"
                          title="Delete service"
                          className="danger"
                          onClick={() =>
                            deleteService(service.id)
                          }
                        >
                          <FiTrash2 />
                        </button>

                      </div>
                    </td>

                  </tr>
                ))
              )}

            </tbody>

          </table>

        </div>

        <div className="clinical-services-footer">
          Showing{" "}
          <strong>
            {filteredServices.length}
          </strong>{" "}
          of{" "}
          <strong>
            {services.length}
          </strong>{" "}
          clinical services
        </div>

      </section>

      {/* ADD / EDIT MODAL */}

      {showModal && (
        <div className="clinical-services-modal-overlay">

          <div className="clinical-services-modal">

            <div className="clinical-services-modal-header">

              <div>
                <div className="clinical-services-eyebrow">
                  SERVICE CONFIGURATION
                </div>

                <h2>
                  {editingService
                    ? "Edit Clinical Service"
                    : "Add Clinical Service"}
                </h2>

                <p>
                  Configure the service details below.
                </p>
              </div>

              <button
                type="button"
                className="clinical-services-modal-close"
                onClick={closeModal}
              >
                <FiX />
              </button>

            </div>

            <form
              className="clinical-services-form"
              onSubmit={handleSubmit}
            >

              <div className="clinical-services-form-grid">

                <div className="clinical-services-field full">
                  <label>
                    Service Name *
                  </label>

                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. General Consultation"
                    required
                  />
                </div>

                <div className="clinical-services-field">
                  <label>
                    Service Code *
                  </label>

                  <input
                    type="text"
                    name="code"
                    value={form.code}
                    onChange={handleChange}
                    placeholder="e.g. CONS-001"
                    required
                  />
                </div>

                <div className="clinical-services-field">
                  <label>
                    Category
                  </label>

                  <select
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                  >
                    <option value="Consultation">
                      Consultation
                    </option>

                    <option value="Screening">
                      Screening
                    </option>

                    <option value="Treatment">
                      Treatment
                    </option>

                    <option value="Assessment">
                      Assessment
                    </option>

                    <option value="Procedure">
                      Procedure
                    </option>

                    <option value="Other">
                      Other
                    </option>
                  </select>
                </div>

                <div className="clinical-services-field">
                  <label>
                    Duration (minutes)
                  </label>

                  <input
                    type="number"
                    name="duration"
                    min="1"
                    value={form.duration}
                    onChange={handleChange}
                  />
                </div>

                <div className="clinical-services-field">
                  <label>
                    Fee (ZAR)
                  </label>

                  <input
                    type="number"
                    name="fee"
                    min="0"
                    step="0.01"
                    value={form.fee}
                    onChange={handleChange}
                    placeholder="0.00"
                  />
                </div>

                <div className="clinical-services-field">
                  <label>
                    Status
                  </label>

                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                  >
                    <option value="Active">
                      Active
                    </option>

                    <option value="Inactive">
                      Inactive
                    </option>
                  </select>
                </div>

                <div className="clinical-services-field full">
                  <label>
                    Description
                  </label>

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Describe the clinical service..."
                    rows="4"
                  />
                </div>

              </div>

              <div className="clinical-services-modal-actions">

                <button
                  type="button"
                  className="clinical-services-cancel-button"
                  onClick={closeModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="clinical-services-save-button"
                >
                  <FiPlus />

                  {editingService
                    ? "Save Changes"
                    : "Add Service"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}
