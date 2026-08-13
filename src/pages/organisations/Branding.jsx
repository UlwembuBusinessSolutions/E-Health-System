import { useState } from "react";

export default function Branding() {
  const [form, setForm] = useState({
    organisationName: "Mamelodi Health Services",
    clinicName: "Mamelodi West Clinic",
    email: "admin@mamelodihealth.co.za",
    phone: "+27 12 555 0101",
    address: "123 Clinic Street, Mamelodi West, Pretoria",
    primaryColor: "#0f766e",
    secondaryColor: "#0f172a",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    alert("Organisation branding saved successfully.");
  };

  return (
    <div style={{ padding: "32px", background: "#f3f7f6", minHeight: "100vh" }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dbe7e4",
          borderRadius: "24px",
          padding: "32px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: "32px" }}>
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
            Tenant Administration
          </div>

          <h1 style={{ margin: 0, fontSize: "42px", color: "#0f172a" }}>
            Organisation Branding
          </h1>

          <p style={{ marginTop: "12px", color: "#64748b", fontSize: "16px" }}>
            Configure tenant identity, branding colours, and contact details displayed across the Ulwembu Healthcare platform.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "28px",
          }}
        >
          <div style={{ display: "grid", gap: "20px" }}>
            <Section title="Organisation Details">
              <div style={fieldGrid}>
                <Field label="Organisation Name">
                  <input
                    name="organisationName"
                    value={form.organisationName}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Clinic / Facility">
                  <input
                    name="clinicName"
                    value={form.clinicName}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Contact Information">
              <div style={fieldGrid}>
                <Field label="Contact Email">
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Phone Number">
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    style={inputStyle}
                  />
                </Field>

                <Field label="Physical Address" fullWidth>
                  <textarea
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical" }}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Brand Colours">
              <div style={fieldGrid}>
                <Field label="Primary Colour">
                  <div style={colorFieldStyle}>
                    <input
                      type="color"
                      name="primaryColor"
                      value={form.primaryColor}
                      onChange={handleChange}
                      style={colorInputStyle}
                    />
                    <input
                      name="primaryColor"
                      value={form.primaryColor}
                      onChange={handleChange}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                </Field>

                <Field label="Secondary Colour">
                  <div style={colorFieldStyle}>
                    <input
                      type="color"
                      name="secondaryColor"
                      value={form.secondaryColor}
                      onChange={handleChange}
                      style={colorInputStyle}
                    />
                    <input
                      name="secondaryColor"
                      value={form.secondaryColor}
                      onChange={handleChange}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                  </div>
                </Field>
              </div>
            </Section>

            <Section title="Organisation Logo">
              <div
                style={{
                  border: "1px dashed #cbd5e1",
                  borderRadius: "16px",
                  padding: "28px",
                  textAlign: "center",
                  background: "#f8fafc",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "18px",
                    background: "#ffffff",
                    border: "1px solid #dbe7e4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                    fontWeight: 700,
                    color: form.primaryColor,
                  }}
                >
                  UH
                </div>

                <div style={{ color: "#0f172a", fontWeight: 600, marginBottom: "6px" }}>
                  Upload organisation logo
                </div>

                <div style={{ color: "#64748b", fontSize: "14px", marginBottom: "16px" }}>
                  PNG, JPG, or SVG · recommended size 512×512px
                </div>

                <input type="file" accept=".png,.jpg,.jpeg,.svg" style={{ fontSize: "14px" }} />
              </div>
            </Section>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button style={secondaryButtonStyle}>Reset</button>
              <button onClick={handleSave} style={primaryButtonStyle}>
                Save Branding Settings
              </button>
            </div>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #dbe7e4",
              borderRadius: "20px",
              padding: "24px",
              height: "fit-content",
            }}
          >
            <h2 style={{ marginTop: 0, color: "#0f172a" }}>Live Preview</h2>

            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "18px",
                overflow: "hidden",
                marginTop: "16px",
              }}
            >
              <div style={{ height: "10px", background: form.primaryColor }} />

              <div style={{ padding: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "18px" }}>
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "16px",
                      background: form.primaryColor,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                    }}
                  >
                    UH
                  </div>

                  <div>
                    <div style={{ fontWeight: 700, color: form.secondaryColor }}>
                      {form.organisationName}
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>
                      {form.clinicName} · Tenant Admin
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "14px",
                    padding: "16px",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 700, color: form.primaryColor, textTransform: "uppercase" }}>
                    Organisation / Facility
                  </div>
                  <div style={{ fontWeight: 600, color: form.secondaryColor }}>
                    {form.organisationName}
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>
                    {form.clinicName} · Tenant Admin
                  </div>
                </div>

                <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
                  <button
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      border: "none",
                      background: form.primaryColor,
                      color: "#ffffff",
                      fontWeight: 600,
                    }}
                  >
                    Preview Primary Action
                  </button>

                  <div style={{ display: "flex", gap: "12px" }}>
                    <div
                      style={{
                        flex: 1,
                        borderRadius: "12px",
                        background: "#ecfeff",
                        border: "1px solid #bae6fd",
                        padding: "14px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Primary</div>
                      <div style={{ fontWeight: 700, color: form.primaryColor }}>{form.primaryColor}</div>
                    </div>

                    <div
                      style={{
                        flex: 1,
                        borderRadius: "12px",
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        padding: "14px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>Secondary</div>
                      <div style={{ fontWeight: 700, color: form.secondaryColor }}>{form.secondaryColor}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dbe7e4",
        borderRadius: "20px",
        padding: "24px",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: "18px", color: "#0f172a" }}>{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children, fullWidth = false }) {
  return (
    <label
      style={{
        display: "grid",
        gap: "8px",
        gridColumn: fullWidth ? "1 / -1" : "auto",
      }}
    >
      <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155" }}>{label}</span>
      {children}
    </label>
  );
}

const fieldGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "18px",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  border: "1px solid #dbe7e4",
  fontSize: "14px",
  color: "#0f172a",
  outline: "none",
  boxSizing: "border-box",
};

const colorFieldStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const colorInputStyle = {
  width: "48px",
  height: "48px",
  border: "1px solid #dbe7e4",
  borderRadius: "12px",
  padding: "4px",
  background: "#ffffff",
  cursor: "pointer",
};

const primaryButtonStyle = {
  background: "#0f766e",
  color: "#ffffff",
  border: "none",
  borderRadius: "12px",
  padding: "12px 18px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  background: "#ffffff",
  color: "#334155",
  border: "1px solid #dbe7e4",
  borderRadius: "12px",
  padding: "12px 18px",
  fontWeight: 600,
  cursor: "pointer",
};