import { useMemo, useState } from "react";
import {
  FiSearch,
  FiPlus,
  FiMoreHorizontal,
  FiCheckCircle,
  FiPauseCircle,
  FiMapPin,
  FiUsers,
  FiGrid,
  FiChevronRight,
} from "react-icons/fi";

import "../../styles/superadmin-organisations.css";

const initialOrganisations = [
  {
    id: 1,
    name: "Mamelodi Health Services",
    type: "Private",
    clinics: 2,
    users: 48,
    modules: 10,
    status: "Active",
    location: "Mamelodi West, Pretoria",
    administrator: "Amo Admin",
  },
  {
    id: 2,
    name: "Tshwane Occupational Health",
    type: "Occupational",
    clinics: 1,
    users: 24,
    modules: 12,
    status: "Active",
    location: "Pretoria, Gauteng",
    administrator: "Health Admin",
  },
  {
    id: 3,
    name: "Ubuntu Community Clinics",
    type: "Public",
    clinics: 2,
    users: 31,
    modules: 13,
    status: "Active",
    location: "Gauteng",
    administrator: "Ubuntu Admin",
  },
  {
    id: 4,
    name: "MediCore Group",
    type: "Private",
    clinics: 1,
    users: 17,
    modules: 15,
    status: "Suspended",
    location: "Centurion, Gauteng",
    administrator: "MediCore Admin",
  },
];

export default function Organisations() {
  const [organisations, setOrganisations] =
    useState(initialOrganisations);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [openMenu, setOpenMenu] = useState(null);

  const filteredOrganisations = useMemo(() => {
    return organisations.filter((organisation) => {
      const matchesSearch =
        organisation.name
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        organisation.location
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        organisation.administrator
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesType =
        typeFilter === "All" ||
        organisation.type === typeFilter;

      const matchesStatus =
        statusFilter === "All" ||
        organisation.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [organisations, search, typeFilter, statusFilter]);

  const activeCount = organisations.filter(
    (organisation) => organisation.status === "Active"
  ).length;

  const suspendedCount = organisations.filter(
    (organisation) => organisation.status === "Suspended"
  ).length;

  const clinicCount = organisations.reduce(
    (total, organisation) => total + organisation.clinics,
    0
  );

  const userCount = organisations.reduce(
    (total, organisation) => total + organisation.users,
    0
  );

  const handleCreateOrganisation = () => {
    const newOrganisation = {
      id: Date.now(),
      name: "New Organisation",
      type: "Private",
      clinics: 0,
      users: 0,
      modules: 0,
      status: "Active",
      location: "Not configured",
      administrator: "Not assigned",
    };

    setOrganisations((current) => [
      ...current,
      newOrganisation,
    ]);
  };

  const handleSuspend = (id) => {
    setOrganisations((current) =>
      current.map((organisation) =>
        organisation.id === id
          ? {
              ...organisation,
              status:
                organisation.status === "Active"
                  ? "Suspended"
                  : "Active",
            }
          : organisation
      )
    );

    setOpenMenu(null);
  };

  return (
    <div className="organisations-page">
      {/* Page header */}
      <div className="organisations-header">
        <div>
          <div className="page-breadcrumb">
            Platform
            <FiChevronRight size={14} />
            Organisations
          </div>

          <h1>Organisations</h1>

          <p>
            Manage client organisations, clinics, users and
            platform access.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={handleCreateOrganisation}
        >
          <FiPlus size={18} />
          Create organisation
        </button>
      </div>

      {/* Summary cards */}
      <div className="organisation-stats">
        <div className="organisation-stat-card">
          <div className="organisation-stat-icon">
            <FiGrid />
          </div>

          <div>
            <span>Total organisations</span>
            <strong>{organisations.length}</strong>
            <small>Registered on platform</small>
          </div>
        </div>

        <div className="organisation-stat-card">
          <div className="organisation-stat-icon active">
            <FiCheckCircle />
          </div>

          <div>
            <span>Active organisations</span>
            <strong>{activeCount}</strong>
            <small>Currently operational</small>
          </div>
        </div>

        <div className="organisation-stat-card">
          <div className="organisation-stat-icon">
            <FiMapPin />
          </div>

          <div>
            <span>Clinics</span>
            <strong>{clinicCount}</strong>
            <small>Across all organisations</small>
          </div>
        </div>

        <div className="organisation-stat-card">
          <div className="organisation-stat-icon">
            <FiUsers />
          </div>

          <div>
            <span>Tenant users</span>
            <strong>{userCount}</strong>
            <small>Registered user accounts</small>
          </div>
        </div>
      </div>

      {/* Main organisation card */}
      <section className="organisation-panel">
        <div className="organisation-panel-header">
          <div>
            <h2>Organisation directory</h2>
            <p>
              View and manage every organisation registered on
              the Ulwembu platform.
            </p>
          </div>

          <div className="organisation-total">
            {filteredOrganisations.length} organisations
          </div>
        </div>

        {/* Filters */}
        <div className="organisation-filters">
          <div className="organisation-search">
            <FiSearch size={18} />

            <input
              type="text"
              placeholder="Search organisations, locations or administrators..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(event.target.value)
            }
          >
            <option value="All">All types</option>
            <option value="Private">Private</option>
            <option value="Public">Public</option>
            <option value="Occupational">
              Occupational
            </option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="All">All statuses</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        {/* Table */}
        <div className="organisation-table-wrapper">
          <table className="organisation-table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Type</th>
                <th>Clinics</th>
                <th>Tenant users</th>
                <th>Modules</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {filteredOrganisations.length === 0 ? (
                <tr>
                  <td
                    colSpan="7"
                    className="empty-state"
                  >
                    <FiSearch size={28} />

                    <strong>
                      No organisations found
                    </strong>

                    <span>
                      Try changing your search or filters.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredOrganisations.map(
                  (organisation) => (
                    <tr key={organisation.id}>
                      <td>
                        <div className="organisation-name-cell">
                          <div className="organisation-avatar">
                            {organisation.name
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {organisation.name}
                            </strong>

                            <span>
                              {organisation.location}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="type-label">
                          {organisation.type}
                        </span>
                      </td>

                      <td>
                        <div className="table-number">
                          <FiMapPin size={15} />
                          {organisation.clinics}
                        </div>
                      </td>

                      <td>
                        <div className="table-number">
                          <FiUsers size={15} />
                          {organisation.users}
                        </div>
                      </td>

                      <td>
                        <div className="module-count">
                          <strong>
                            {organisation.modules}/20
                          </strong>

                          <div className="module-progress">
                            <span
                              style={{
                                width: `${Math.min(
                                  organisation.modules * 5,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            organisation.status ===
                            "Active"
                              ? "status-active"
                              : "status-suspended"
                          }`}
                        >
                          {organisation.status ===
                          "Active" ? (
                            <FiCheckCircle size={14} />
                          ) : (
                            <FiPauseCircle size={14} />
                          )}

                          {organisation.status}
                        </span>
                      </td>

                      <td className="actions-cell">
                        <button
                          type="button"
                          className="action-button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu ===
                                organisation.id
                                ? null
                                : organisation.id
                            )
                          }
                          aria-label="Organisation actions"
                        >
                          <FiMoreHorizontal size={18} />
                        </button>

                        {openMenu === organisation.id && (
                          <div className="action-menu">
                            <button type="button">
                              View organisation
                            </button>

                            <button type="button">
                              Manage clinics
                            </button>

                            <button type="button">
                              Module entitlements
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleSuspend(
                                  organisation.id
                                )
                              }
                            >
                              {organisation.status ===
                              "Active"
                                ? "Suspend organisation"
                                : "Activate organisation"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Suspended organisation notice */}
      {suspendedCount > 0 && (
        <div className="organisation-notice">
          <FiPauseCircle size={20} />

          <div>
            <strong>
              {suspendedCount} organisation
              {suspendedCount > 1 ? "s" : ""} currently
              suspended
            </strong>

            <p>
              Suspended organisations remain visible to
              Super Admins but cannot access tenant
              operations.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}