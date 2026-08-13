import { useState } from "react";

const initialStock = [
  { id: 1, name: "Paracetamol 500mg", qty: 320, status: "In Stock" },
  { id: 2, name: "Amoxicillin 250mg", qty: 120, status: "Low Stock" },
  { id: 3, name: "Ibuprofen 200mg", qty: 560, status: "In Stock" },
  { id: 4, name: "Vitamin C Tablets", qty: 45, status: "Low Stock" },
];

export default function Pharmacy() {
  const [stock, setStock] = useState(initialStock);
  const [patient, setPatient] = useState("");
  const [medication, setMedication] = useState(initialStock[0].name);
  const [quantity, setQuantity] = useState("");

  const handleDispense = (e) => {
    e.preventDefault();

    if (!patient || !quantity) {
      alert("Please complete all fields.");
      return;
    }

    setStock((prev) =>
      prev.map((item) =>
        item.name === medication
          ? {
              ...item,
              qty: Math.max(0, item.qty - Number(quantity)),
            }
          : item
      )
    );

    alert(`Prescription issued for ${patient}`);
    setPatient("");
    setQuantity("");
  };

  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dbe7e4",
          borderRadius: "24px",
          padding: "32px",
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              color: "#64748b",
              fontSize: "14px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "8px",
            }}
          >
            Pharmacy
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "48px",
              color: "#0f172a",
              lineHeight: 1.1,
            }}
          >
            Pharmacy Dashboard
          </h1>

          <p
            style={{
              marginTop: "12px",
              color: "#64748b",
              fontSize: "18px",
            }}
          >
            Manage prescriptions, monitor stock levels, and track medication
            dispensing.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          {[
            { label: "Prescriptions Today", value: 48 },
            { label: "Low Stock Items", value: 2 },
            { label: "Dispensed This Week", value: 286 },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "8px" }}>
                {item.label}
              </div>
              <div style={{ fontSize: "32px", fontWeight: 700, color: "#0f172a" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dbe7e4",
            borderRadius: "20px",
            padding: "24px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, color: "#0f172a" }}>Medication Stock</h2>
              <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                Current inventory overview
              </p>
            </div>

            <button
              style={{
                background: "#0f766e",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "10px 16px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Add Medication
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={thStyle}>Medication</th>
                <th style={thStyle}>Quantity</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((item) => (
                <tr key={item.id}>
                  <td style={tdStyle}>{item.name}</td>
                  <td style={tdStyle}>{item.qty}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: "6px 12px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        background:
                          item.status === "Low Stock" ? "#fef2f2" : "#ecfdf5",
                        color:
                          item.status === "Low Stock" ? "#b91c1c" : "#047857",
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #dbe7e4",
            borderRadius: "20px",
            padding: "24px",
          }}
        >
          <h2 style={{ marginTop: 0, color: "#0f172a", textAlign: "center" }}>
            Issue Prescription
          </h2>

          <p style={{ textAlign: "center", color: "#64748b", marginBottom: "24px" }}>
            Quickly dispense medication for a patient visit.
          </p>

          <form
            onSubmit={handleDispense}
            style={{ display: "grid", gap: "16px", maxWidth: "700px", margin: "0 auto" }}
          >
            <div>
              <label style={labelStyle}>Patient Name</label>
              <input
                type="text"
                value={patient}
                onChange={(e) => setPatient(e.target.value)}
                placeholder="Enter patient name"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Medication</label>
              <select
                value={medication}
                onChange={(e) => setMedication(e.target.value)}
                style={inputStyle}
              >
                {stock.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              style={{
                background: "#0f766e",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "12px 18px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Issue Prescription
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "13px",
  color: "#475569",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle = {
  padding: "16px",
  borderBottom: "1px solid #eef2f7",
  color: "#0f172a",
};

const labelStyle = {
  display: "block",
  marginBottom: "8px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#334155",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #cbd5e1",
  fontSize: "14px",
  boxSizing: "border-box",
};