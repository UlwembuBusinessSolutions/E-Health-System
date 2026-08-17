import { FaClock, FaStethoscope, FaUserCheck } from "react-icons/fa";

const nowServing = [
  { token: "A001", patient: "Nomsa Dlamini", room: "Room 2", clinician: "Dr. Nkosi" },
  { token: "A002", patient: "Thabo Mokoena", room: "Triage 1", clinician: "Nurse Molefe" },
];

const waitingQueue = [
  { token: "A003", patient: "Lerato Nkosi", wait: "7 min" },
  { token: "A004", patient: "Sipho Khumalo", wait: "11 min" },
  { token: "A005", patient: "Ayanda Maseko", wait: "15 min" },
  { token: "A006", patient: "Zanele Sithole", wait: "18 min" },
  { token: "A007", patient: "Peter Baloyi", wait: "22 min" },
];

export default function QueueBoard() {
  const currentTime = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: "32px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
            paddingBottom: "20px",
            borderBottom: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div>
            <div
              style={{
                color: "#5eead4",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px",
              }}
            >
              Mamelodi Health Services
            </div>

            <h1 style={{ fontSize: "52px", margin: 0 }}>Waiting Room Queue Board</h1>

            <p style={{ color: "#cbd5e1", fontSize: "18px", marginTop: "12px" }}>
              Please wait for your token number to be called. Thank you for choosing Ulwembu Healthcare.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              background: "rgba(15,118,110,0.18)",
              border: "1px solid rgba(94,234,212,0.22)",
              borderRadius: "18px",
              padding: "16px 20px",
            }}
          >
            <FaClock size={20} color="#5eead4" />
            <div>
              <div style={{ fontSize: "12px", color: "#99f6e4", textTransform: "uppercase", fontWeight: 700 }}>
                Current Time
              </div>
              <div style={{ fontSize: "28px", fontWeight: 700 }}>{currentTime}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.9fr",
            gap: "28px",
          }}
        >
          <div
            style={{
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "24px",
              padding: "28px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
              <FaUserCheck size={22} color="#5eead4" />
              <h2 style={{ margin: 0, fontSize: "30px" }}>Now Serving</h2>
            </div>

            <div style={{ display: "grid", gap: "18px" }}>
              {nowServing.map((item) => (
                <div
                  key={item.token}
                  style={{
                    background: "#0f766e",
                    borderRadius: "22px",
                    padding: "24px",
                    display: "grid",
                    gap: "12px",
                    boxShadow: "0 16px 32px rgba(15,118,110,0.25)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#ccfbf1" }}>
                      Token Number
                    </span>
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#ecfeff" }}>{item.room}</span>
                  </div>

                  <div style={{ fontSize: "72px", fontWeight: 800, lineHeight: 1, letterSpacing: "0.04em" }}>
                    {item.token}
                  </div>

                  <div style={{ display: "grid", gap: "4px" }}>
                    <div style={{ fontSize: "28px", fontWeight: 700 }}>{item.patient}</div>
                    <div style={{ fontSize: "18px", color: "#d1fae5" }}>{item.clinician}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "24px" }}>
            <div
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "24px",
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                <FaClock size={20} color="#5eead4" />
                <h2 style={{ margin: 0, fontSize: "26px" }}>Waiting Queue</h2>
              </div>

              <div style={{ display: "grid", gap: "12px" }}>
                {waitingQueue.map((item, index) => (
                  <div
                    key={item.token}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: "16px",
                      background: index === 0 ? "rgba(15,118,110,0.18)" : "rgba(255,255,255,0.04)",
                      border: index === 0
                        ? "1px solid rgba(94,234,212,0.25)"
                        : "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: "rgba(15,118,110,0.28)",
                          color: "#5eead4",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                      >
                        {item.token}
                      </div>

                      <div>
                        <div style={{ fontWeight: 600, fontSize: "16px" }}>{item.patient}</div>
                        <div style={{ fontSize: "13px", color: "#94a3b8" }}>Estimated wait: {item.wait}</div>
                      </div>
                    </div>

                    <div style={{ color: "#5eead4", fontWeight: 700 }}>#{index + 1}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "24px",
                padding: "24px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
                <FaStethoscope size={20} color="#5eead4" />
                <h2 style={{ margin: 0, fontSize: "26px" }}>Queue Status</h2>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                <StatusRow label="Reception Queue" value="14 waiting" accent="#5eead4" />
                <StatusRow label="Triage Queue" value="3 waiting" accent="#fbbf24" />
                <StatusRow label="Consultation Rooms Available" value="2 rooms" accent="#86efac" />
                <StatusRow label="Average Processing Time" value="11 minutes" accent="#c4b5fd" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, accent }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: "14px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span style={{ color: "#cbd5e1", fontSize: "14px" }}>{label}</span>
      <span style={{ color: accent, fontWeight: 700 }}>{value}</span>
    </div>
  );
}