import {
  FaUsers,
  FaClock,
  FaCalendarCheck,
  FaStethoscope,
  FaUserCheck,
  FaPlus,
} from "react-icons/fa";

const queue = [
  { token: "A001", patient: "Nomsa Dlamini", type: "Appointment", wait: "12 min" },
  { token: "A002", patient: "Thabo Mokoena", type: "Walk-in", wait: "18 min" },
  { token: "A003", patient: "Lerato Nkosi", type: "Follow-up", wait: "7 min" },
  { token: "A004", patient: "Sipho Khumalo", type: "Emergency Review", wait: "4 min" },
];

export default function ReceptionDashboard() {
  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1300px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "28px",
            gap: "16px",
          }}
        >
          <div>
            <div
              style={{
                color: "#64748b",
                fontSize: "14px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "8px",
              }}
            >
              Reception & Queue
            </div>

            <h1 style={{ fontSize: "44px", margin: 0, color: "#0f172a" }}>
              Reception Dashboard
            </h1>

            <p style={{ color: "#64748b", fontSize: "16px", marginTop: "12px" }}>
              Manage patient arrivals, queue flow, appointments, and walk-in visits for Mamelodi West Clinic.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button style={secondaryButton}>
              <FaUserCheck size={12} />
              Check-In Patient
            </button>

            <button style={primaryButton}>
              <FaPlus size={12} />
              New Walk-In Visit
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
            marginBottom: "28px",
          }}
        >
          <StatCard icon={<FaUsers size={20} />} label="Patients Waiting" value="14" />
          <StatCard icon={<FaClock size={20} />} label="Average Wait Time" value="11 min" />
          <StatCard icon={<FaCalendarCheck size={20} />} label="Appointments Today" value="32" />
          <StatCard icon={<FaStethoscope size={20} />} label="Patients Seen Today" value="27" />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "24px",
          }}
        >
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, color: "#0f172a" }}>Current Queue</h2>
                <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: "14px" }}>
                  Patients currently waiting for consultation or triage.
                </p>
              </div>

              <button style={secondaryButton}>Refresh Queue</button>
            </div>

            <div style={{ display: "grid", gap: "12px" }}>
              {queue.map((item) => (
                <div
                  key={item.token}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    background: "#f8fafc",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                      style={{
                        width: "48px",
                        height: "48px",
                        borderRadius: "12px",
                        background: "#ecfeff",
                        color: "#0f766e",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                      }}
                    >
                      {item.token}
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.patient}</div>
                      <div style={{ fontSize: "13px", color: "#64748b" }}>{item.type}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{item.wait}</div>
                    <button style={{ ...secondaryButton, marginTop: "8px" }}>Call Next</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px" }}>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Quick Reception Actions</h2>

              <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
                <button style={actionButton}>Register New Patient</button>
                <button style={actionButton}>Check-In Appointment</button>
                <button style={actionButton}>Create Walk-In Visit</button>
                <button style={actionButton}>Print Queue Ticket</button>
                <button style={actionButton}>Transfer to Triage</button>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, color: "#0f172a" }}>Today's Activity</h2>

              <div style={{ display: "grid", gap: "16px", marginTop: "18px" }}>
                <ActivityItem
                  title="Patient checked in"
                  description="Nomsa Dlamini checked in for a scheduled appointment"
                  time="10:14"
                />
                <ActivityItem
                  title="Walk-in visit created"
                  description="Thabo Mokoena added to the general consultation queue"
                  time="09:58"
                />
                <ActivityItem
                  title="Queue ticket printed"
                  description="Ticket A004 issued for emergency review triage"
                  time="09:41"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div style={cardStyle}>
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: "#ecfeff",
          color: "#0f766e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
        }}
      >
        {icon}
      </div>

      <div style={{ fontSize: "14px", color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: "32px", fontWeight: 700, color: "#0f172a", marginTop: "6px" }}>
        {value}
      </div>
    </div>
  );
}

function ActivityItem({ title, description, time }) {
  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div style={{ fontWeight: 600, color: "#0f172a" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "#64748b" }}>{description}</div>
      <div style={{ fontSize: "12px", color: "#94a3b8" }}>{time}</div>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
};

const primaryButton = {
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const secondaryButton = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "12px",
  padding: "10px 14px",
  fontWeight: 600,
  cursor: "pointer",
  color: "#334155",
};

const actionButton = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #dbe7e4",
  background: "#f8fafc",
  color: "#0f172a",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
};