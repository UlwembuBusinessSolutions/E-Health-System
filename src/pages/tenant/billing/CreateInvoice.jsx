import { useState } from "react";
import { FaPlus, FaTrash } from "react-icons/fa";

const servicesList = [
  { name: "General Consultation", price: 350 },
  { name: "Follow-up Consultation", price: 200 },
  { name: "Blood Pressure Check", price: 80 },
  { name: "Laboratory Test", price: 150 },
  { name: "Prescription Dispensing", price: 120 },
];

export default function CreateInvoice() {
  const [patientName, setPatientName] = useState("");
  const [paymentType, setPaymentType] = useState("cash");
  const [items, setItems] = useState([
    { service: "General Consultation", quantity: 1, price: 350 },
  ]);

  const updateItem = (index, field, value) => {
    const updated = [...items];

    if (field === "service") {
      const selected = servicesList.find((s) => s.name === value);
      updated[index].service = value;
      updated[index].price = selected?.price || 0;
    } else {
      updated[index][field] = value;
    }

    setItems(updated);
  };

  const addItem = () => {
    setItems([...items, { service: "General Consultation", quantity: 1, price: 350 }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ marginBottom: "24px" }}>
          <div style={{ color: "#64748b", fontSize: "14px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>
            Billing / Invoice Generation
          </div>
          <h1 style={{ fontSize: "42px", margin: 0, color: "#0f172a" }}>Create Invoice</h1>
          <p style={{ color: "#64748b", marginTop: "10px" }}>
            Generate patient invoices for consultations, procedures, pharmacy items, and laboratory services.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "24px" }}>
          <div style={cardStyle}>
            <h2 style={sectionTitle}>Patient Information</h2>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Patient Name</label>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter patient name"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Payment Responsibility</label>
                <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} style={inputStyle}>
                  <option value="cash">Cash / Card / EFT</option>
                  <option value="medical-aid">Medical Aid / Insurance</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={sectionTitle}>Invoice Items</h2>

                <button onClick={addItem} style={secondaryButton}>
                  <FaPlus size={12} />
                  Add Item
                </button>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {items.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "16px",
                      padding: "16px",
                      background: "#f8fafc",
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr auto",
                      gap: "12px",
                      alignItems: "end",
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Service</label>
                      <select
                        value={item.service}
                        onChange={(e) => updateItem(index, "service", e.target.value)}
                        style={inputStyle}
                      >
                        {servicesList.map((service) => (
                          <option key={service.name} value={service.name}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Unit Price</label>
                      <input value={`R${item.price}`} readOnly style={inputStyle} />
                    </div>

                    <button
                      onClick={() => removeItem(index)}
                      style={{
                        ...secondaryButton,
                        padding: "12px",
                        justifyContent: "center",
                        color: "#dc2626",
                      }}
                    >
                      <FaTrash size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitle}>Invoice Summary</h2>

            <div style={{ display: "grid", gap: "14px", marginTop: "18px" }}>
              {items.map((item, index) => (
                <div key={index} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                  <span>{item.service} × {item.quantity}</span>
                  <strong>R{item.quantity * item.price}</strong>
                </div>
              ))}

              <hr style={{ border: "none", borderTop: "1px solid #e2e8f0" }} />

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <strong>R{subtotal.toFixed(2)}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>VAT (15%)</span>
                <strong>R{vat.toFixed(2)}</strong>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", fontWeight: 700, color: "#0f172a", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
                <span>Total</span>
                <span>R{total.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: "grid", gap: "12px", marginTop: "24px" }}>
              <button style={primaryButton}>Generate Invoice</button>
              <button style={secondaryButton}>Save Draft</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "20px",
  padding: "24px",
};

const sectionTitle = {
  margin: 0,
  color: "#0f172a",
  fontSize: "22px",
};

const labelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
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

const primaryButton = {
  background: "#0f766e",
  color: "white",
  border: "none",
  borderRadius: "12px",
  padding: "12px 16px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButton = {
  background: "#ffffff",
  border: "1px solid #dbe7e4",
  borderRadius: "12px",
  padding: "12px 16px",
  fontWeight: 600,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};