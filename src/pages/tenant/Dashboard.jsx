export default function TenantDashboard() {
  const stats = [
    { title: "Patients Waiting", value: "24", color: "#2563eb" },
    { title: "Appointments Today", value: "42", color: "#0f766e" },
    { title: "Consultations In Progress", value: "7", color: "#ea580c" },
    { title: "Outstanding Accounts", value: "R 18 450", color: "#7c3aed" },
  ];

  return (
    <div style={{ display: "grid", gap: "28px" }}>
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "32px",
            fontWeight: 800,
            color: "#10233f",
          }}
        >
          Clinic Operations Dashboard
        </h1>

        <p style={{ marginTop: "10px", color: "#64748b" }}>
          Operational overview for patient flow, consultations, pharmacy, and billing.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.title}
            style={{
              background: "#ffffff",
              border: "1px solid #dbe7ef",
              borderRadius: "22px",
              padding: "24px",
              boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ fontSize: "13px", color: "#64748b" }}>
              {stat.title}
            </div>

            <div
              style={{
                marginTop: "10px",
                fontSize: "34px",
                fontWeight: 800,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "20px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dbe7ef",
            borderRadius: "24px",
            padding: "24px",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#10233f" }}>Today's Queue</h2>

          <div style={{ display: "grid", gap: "14px" }}>
            <QueueItem mpi="MPI-20260814-001" name="Nomsa Dlamini" stage="Vitals" />
            <QueueItem mpi="MPI-20260814-002" name="Thabo Mokoena" stage="Consultation" />
            <QueueItem mpi="MPI-20260814-003" name="Lerato Molefe" stage="Pharmacy" />
          </div>
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dbe7ef",
            borderRadius: "24px",
            padding: "24px",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#10233f" }}>Quick Actions</h2>

          <div style={{ display: "grid", gap: "12px" }}>
            <QuickButton label="Register Patient" />
            <QuickButton label="Create Appointment" />
            <QuickButton label="Start Consultation" />
            <QuickButton label="Dispense Medication" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueItem({ mpi, name, stage }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: "16px",
        background: "#f8fbfd",
        border: "1px solid #e2e8f0",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, color: "#10233f" }}>{name}</div>
        <div style={{ fontSize: "12px", color: "#64748b" }}>{mpi}</div>
      </div>

      <span
        style={{
          padding: "6px 10px",
          borderRadius: "999px",
          background: "#dff4f2",
          color: "#0f766e",
          fontSize: "12px",
          fontWeight: 700,
        }}
      >
        {stage}
      </span>
    </div>
  );
}

function QuickButton({ label }) {
  return (
    <button
      style={{
        padding: "12px 14px",
        borderRadius: "14px",
        border: "1px solid #dbe7ef",
        background: "#ffffff",
        fontWeight: 600,
        color: "#10233f",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {label}
    </button>
  );
}