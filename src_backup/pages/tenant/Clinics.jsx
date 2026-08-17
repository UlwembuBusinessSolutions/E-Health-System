import { useMemo, useState } from "react";
import { FiPlus, FiSearch } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const initialClinics = [
  {
    id: "CLI-1801",
    name: "Mamelodi West Clinic",
    organisation: "Mamelodi Health Services",
    address: "Mamelodi, Pretoria",
    hours: "07:30–16:00",
    status: "Active",
  },
  {
    id: "CLI-1802",
    name: "Mamelodi East Clinic",
    organisation: "Mamelodi Health Services",
    address: "Mamelodi East, Pretoria",
    hours: "07:30–16:00",
    status: "Active",
  },
];

export default function Clinics() {
  const navigate = useNavigate();

  const [clinics, setClinics] = useState(initialClinics);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const filteredClinics = useMemo(() => {
    return clinics.filter((clinic) => {
      const searchValue = search.toLowerCase().trim();

      const matchesSearch =
        !searchValue ||
        clinic.name.toLowerCase().includes(searchValue) ||
        clinic.id.toLowerCase().includes(searchValue) ||
        clinic.address.toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "All statuses" ||
        clinic.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clinics, search, statusFilter]);

  const handleAddClinic = () => {
    navigate("/tenant/clinics/add");
  };

  const handleSuspend = (clinicId) => {
    setClinics((currentClinics) =>
      currentClinics.map((clinic) =>
        clinic.id === clinicId
          ? {
              ...clinic,
              status: clinic.status === "Active" ? "Suspended" : "Active",
            }
          : clinic
      )
    );
  };

  const handleModules = (clinic) => {
    navigate(`/tenant/clinics/${clinic.id}/modules`);
  };

  return (
    <div className="tenant-page">
      <div className="tenant-page-header">
        <div>
          <h1>Clinic Network</h1>
          <p>Manage facilities within your organisation.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={handleAddClinic}
        >
          <FiPlus size={16} />
          Add clinic
        </button>
      </div>

      <div className="clinic-filters">
        <div className="search-input-wrapper">
          <FiSearch size={17} />

          <input
            type="text"
            placeholder="Search clinic"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="status-filter"
        >
          <option>All statuses</option>
          <option>Active</option>
          <option>Suspended</option>
        </select>
      </div>

      <div className="clinic-table-card">
        <div className="clinic-table-wrapper">
          <table className="clinic-table">
            <thead>
              <tr>
                <th>CLINIC</th>
                <th>ORGANISATION</th>
                <th>ADDRESS</th>
                <th>HOURS</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredClinics.length > 0 ? (
                filteredClinics.map((clinic) => (
                  <tr key={clinic.id}>
                    <td>
                      <div className="clinic-name">
                        {clinic.name}
                      </div>

                      <div className="clinic-id">
                        {clinic.id}
                      </div>
                    </td>

                    <td>{clinic.organisation}</td>

                    <td>{clinic.address}</td>

                    <td>{clinic.hours}</td>

                    <td>
                      <span
                        className={`status-badge ${
                          clinic.status === "Active"
                            ? "status-active"
                            : "status-suspended"
                        }`}
                      >
                        {clinic.status}
                      </span>
                    </td>

                    <td>
                      <div className="clinic-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => handleModules(clinic)}
                        >
                          Modules
                        </button>

                        <button
                          type="button"
                          className={`suspend-button ${
                            clinic.status === "Suspended"
                              ? "activate-button"
                              : ""
                          }`}
                          onClick={() => handleSuspend(clinic.id)}
                        >
                          {clinic.status === "Active"
                            ? "Suspend"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">
                    <div className="empty-clinics">
                      <strong>No clinics found</strong>
                      <span>
                        Try changing your search or status filter.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}