import { useMemo, useState } from "react";
import {
  FaSearch,
  FaClipboardList,
  FaUserClock,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

const PATIENT_STORAGE_KEY = "ulwembu_patients";
const VISIT_STORAGE_KEY = "ulwembu_visits";

function generateQueueNumber(existingVisits) {
  const today = new Date().toISOString().slice(0, 10);

  const todaysVisits = existingVisits.filter(
    (visit) => visit.visitDate === today
  );

  const next = todaysVisits.length + 1;

  return `Q-${String(next).padStart(3, "0")}`;
}

export default function ReceptionDashboard() {
  const patients = useMemo(
    () =>
      JSON.parse(localStorage.getItem(PATIENT_STORAGE_KEY) || "[]"),
    []
  );

  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [priority, setPriority] = useState("Routine");
  const [reason, setReason] = useState("");
  const [queue, setQueue] = useState(() =>
    JSON.parse(localStorage.getItem(VISIT_STORAGE_KEY) || "[]")
  );

  const filteredPatients = patients.filter((patient) => {
    const query = search.toLowerCase();

    return (
      patient.fullName?.toLowerCase().includes(query) ||
      patient.mpi?.toLowerCase().includes(query) ||
      patient.idNumber?.toLowerCase().includes(query)
    );
  });

  function createVisit() {
    if (!selectedPatient) return;

    const visit = {
      id: crypto.randomUUID(),
      mpi: selectedPatient.mpi,
      patientName: selectedPatient.fullName,
      queueNumber: generateQueueNumber(queue),
      priority,
      reason,
      status: "Waiting",
      visitDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };

    const updated = [visit, ...queue];

    localStorage.setItem(VISIT_STORAGE_KEY, JSON.stringify(updated));

    setQueue(updated);
    setSelectedPatient(null);
    setSearch("");
    setReason("");
    setPriority("Routine");
  }

  const waitingCount = queue.filter((v) => v.status === "Waiting").length;
  const urgentCount = queue.filter((v) => v.priority === "Urgent").length;

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div>
        <h1 style={{ marginBottom: "6px" }}>Reception & Queue</h1>
        <p style={{ color: "var(--muted)", margin: 0 }}>
          Create patient visits, assign queue numbers, and manage clinic flow.
        </p>
      </div>

      {/* Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
        }}
      >
        <StatCard
          icon={<FaClipboardList />}
          label="Queue Today"
          value={queue.length}
        />
        <StatCard
          icon={<FaUserClock />}
          label="Waiting Patients"
          value={waitingCount}
        />
        <StatCard
          icon={<FaExclamationTriangle />}
          label="Urgent Cases"
          value={urgentCount}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "24px",
          alignItems: "start",
        }}
      >
        {/* Patient Search */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "var(--shadow)",
            display: "grid",
            gap: "18px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Find Patient</h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "var(--muted)",
                fontSize: "14px",
              }}
            >
              Search by MPI, patient name, or ID number.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px 14px",
              border: "1px solid var(--line)",
              borderRadius: "12px",
              background: "var(--surface-alt)",
            }}
          >
            <FaSearch size={14} color="var(--muted)" />

            <input
              type="text"
              placeholder="Search patient..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                border: "none",
                outline: "none",
                background: "transparent",
                width: "100%",
                fontSize: "14px",
                color: "var(--text)",
              }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gap: "10px",
              maxHeight: "420px",
              overflowY: "auto",
            }}
          >
            {filteredPatients.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--muted)",
                  border: "1px dashed var(--line)",
                  borderRadius: "16px",
                }}
              >
                No patients found
              </div>
            ) : (
              filteredPatients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => setSelectedPatient(patient)}
                  style={{
                    textAlign: "left",
                    padding: "14px",
                    borderRadius: "14px",
                    border:
                      selectedPatient?.id === patient.id
                        ? "1px solid var(--accent)"
                        : "1px solid var(--line)",
                    background:
                      selectedPatient?.id === patient.id
                        ? "rgba(15, 118, 110, 0.08)"
                        : "var(--surface-alt)",
                    cursor: "pointer",
                    display: "grid",
                    gap: "4px",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                    {patient.fullName}
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {patient.mpi}
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {patient.phone || "No contact number"}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Visit Form */}
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "20px",
            padding: "24px",
            boxShadow: "var(--shadow)",
            display: "grid",
            gap: "18px",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Create Visit</h2>
            <p
              style={{
                margin: "6px 0 0",
                color: "var(--muted)",
                fontSize: "14px",
              }}
            >
              Select a patient and assign a queue entry.
            </p>
          </div>

          {selectedPatient ? (
            <div
              style={{
                padding: "16px",
                borderRadius: "16px",
                background: "rgba(15, 118, 110, 0.08)",
                border: "1px solid rgba(15, 118, 110, 0.2)",
                display: "grid",
                gap: "6px",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--ink)" }}>
                {selectedPatient.fullName}
              </div>
              <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                {selectedPatient.mpi}
              </div>
              <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                {selectedPatient.idNumber}
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: "16px",
                borderRadius: "16px",
                border: "1px dashed var(--line)",
                color: "var(--muted)",
                fontSize: "14px",
              }}
            >
              Select a patient from the search results.
            </div>
          )}

          <label style={labelStyle}>
            Priority
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              style={inputStyle}
            >
              <option>Routine</option>
              <option>Urgent</option>
              <option>Emergency</option>
            </select>
          </label>

          <label style={labelStyle}>
            Reason for Visit
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              placeholder="Describe the patient's presenting complaint or reason for the visit..."
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <button
            type="button"
            disabled={!selectedPatient}
            onClick={createVisit}
            style={{
              padding: "12px 18px",
              borderRadius: "12px",
              border: "none",
              background: selectedPatient ? "var(--accent)" : "#94a3b8",
              color: "white",
              fontWeight: 700,
              cursor: selectedPatient ? "pointer" : "not-allowed",
            }}
          >
            Add to Queue
          </button>
        </div>
      </div>

      {/* Queue Table */}
      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "var(--shadow)",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <h2 style={{ margin: 0 }}>Today's Queue</h2>
        </div>

        {queue.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            No active visits have been created yet.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-alt)" }}>
                  <th style={thStyle}>Queue</th>
                  <th style={thStyle}>Patient</th>
                  <th style={thStyle}>MPI</th>
                  <th style={thStyle}>Priority</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>

              <tbody>
                {queue.map((visit) => (
                  <tr key={visit.id} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "inline-flex",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "rgba(15, 118, 110, 0.1)",
                          color: "var(--accent)",
                          fontWeight: 700,
                          fontSize: "12px",
                        }}
                      >
                        {visit.queueNumber}
                      </div>
                    </td>

                    <td style={tdStyle}>{visit.patientName}</td>
                    <td style={tdStyle}>{visit.mpi}</td>
                    <td style={tdStyle}>
                      <PriorityBadge priority={visit.priority} />
                    </td>
                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "rgba(245, 158, 11, 0.12)",
                          color: "#92400e",
                          fontWeight: 600,
                          fontSize: "12px",
                        }}
                      >
                        <FaCheckCircle size={11} />
                        {visit.status}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "18px",
        padding: "18px",
        boxShadow: "var(--shadow)",
        display: "grid",
        gap: "10px",
      }}
    >
      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "12px",
          background: "rgba(15, 118, 110, 0.1)",
          color: "var(--accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </div>

      <div style={{ fontSize: "12px", color: "var(--muted)" }}>
        {label}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    Routine: {
      background: "rgba(22, 163, 74, 0.12)",
      color: "#166534",
    },
    Urgent: {
      background: "rgba(245, 158, 11, 0.12)",
      color: "#92400e",
    },
    Emergency: {
      background: "rgba(220, 38, 38, 0.12)",
      color: "#991b1b",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: "999px",
        fontWeight: 600,
        fontSize: "12px",
        ...styles[priority],
      }}
    >
      {priority}
    </span>
  );
}

const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid var(--line)",
  borderRadius: "10px",
  background: "var(--surface-alt)",
  color: "var(--text)",
  fontSize: "14px",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "grid",
  gap: "6px",
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text)",
};

const thStyle = {
  textAlign: "left",
  padding: "14px 18px",
  fontSize: "12px",
  fontWeight: 700,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const tdStyle = {
  padding: "16px 18px",
  fontSize: "14px",
  color: "var(--text)",
};
