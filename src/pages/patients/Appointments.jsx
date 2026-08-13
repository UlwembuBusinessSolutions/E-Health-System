import { useState } from "react";

export default function Appointments() {
  const [appointments, setAppointments] = useState([
    {
      id: 1,
      patient: "John Dlamini",
      doctor: "Dr. Nkosi",
      date: "2026-08-07",
      time: "09:00",
      status: "Confirmed",
    },
    {
      id: 2,
      patient: "Sarah Moyo",
      doctor: "Dr. Dlamini",
      date: "2026-08-07",
      time: "10:30",
      status: "Waiting",
    },
  ]);

  const [form, setForm] = useState({
    patient: "",
    doctor: "",
    date: "",
    time: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.patient || !form.doctor || !form.date || !form.time) {
      alert("Please complete all fields");
      return;
    }

    setAppointments([
      ...appointments,
      {
        id: Date.now(),
        ...form,
        status: "Confirmed",
      },
    ]);

    setForm({
      patient: "",
      doctor: "",
      date: "",
      time: "",
    });
  };

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, color: "#0f172a" }}>Appointments</h1>
        <p style={{ color: "#64748b", marginTop: "6px" }}>
          Schedule and manage patient appointments for Mamelodi West Clinic.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginTop: "20px",
          }}
        >
          <div>
            <label style={labelStyle}>Patient</label>
            <input
              type="text"
              name="patient"
              value={form.patient}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Doctor</label>
            <select
              name="doctor"
              value={form.doctor}
              onChange={handleChange}
              style={inputStyle}
            >
              <option value="">Select doctor</option>
              <option>Dr. Nkosi</option>
              <option>Dr. Dlamini</option>
              <option>Dr. Moyo</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Date</label>
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Time</label>
            <input
              type="time"
              name="time"
              value={form.time}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" style={primaryButton}>
              Schedule Appointment
            </button>
          </div>
        </form>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h2 style={{ margin: 0 }}>Upcoming Appointments</h2>
          <span style={{ color: "#64748b", fontSize: "14px" }}>
            {appointments.length} appointments
          </span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={thStyle}>Patient</th>
              <th style={thStyle}>Doctor</th>
              <th style={thStyle}>Date</th>
              <th style={thStyle}>Time</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>

          <tbody>
            {appointments.map((appt) => (
              <tr key={appt.id}>
                <td style={tdStyle}>{appt.patient}</td>
                <td style={tdStyle}>{appt.doctor}</td>
                <td style={tdStyle}>{appt.date}</td>
                <td style={tdStyle}>{appt.time}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: "999px",
                      background:
                        appt.status === "Confirmed"
                          ? "#dcfce7"
                          : "#fef3c7",
                      color:
                        appt.status === "Confirmed"
                          ? "#166534"
                          : "#92400e",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    {appt.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.05)",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontWeight: 600,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  boxSizing: "border-box",
};

const primaryButton = {
  background: "#0f766e",
  color: "white",
  border: "none",
  padding: "12px 18px",
  borderRadius: "12px",
  fontWeight: 600,
  cursor: "pointer",
};

const thStyle = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: "13px",
};

const tdStyle = {
  padding: "14px 12px",
  borderBottom: "1px solid #f1f5f9",
  color: "#0f172a",
};