import { useState } from "react";
import {
  FaPalette,
  FaBuilding,
  FaUpload,
  FaSave,
  FaUndo,
  FaEye,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaGlobe,
  FaCheckCircle,
} from "react-icons/fa";

const initialBranding = {
  organisationName: "Mamelodi Health Services",
  facilityName: "Mamelodi West Clinic",
  registrationNumber: "MHS-2026-0018",
  email: "admin@mamelodihealth.co.za",
  phone: "012 555 0100",
  website: "www.mamelodihealth.co.za",
  address: "Mamelodi West, Pretoria, Gauteng",
  primaryColor: "#0f766e",
  secondaryColor: "#134e4a",
  accentColor: "#14b8a6",
  tagline: "Quality healthcare for every community",
};

function ColourField({ label, value, onChange }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          fontWeight: 700,
          color: "#334155",
          marginBottom: "7px",
        }}
      >
        {label}
      </label>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          border: "1px solid #dbe3ea",
          borderRadius: "10px",
          padding: "7px",
          background: "#ffffff",
        }}
      >
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{
            width: "34px",
            height: "30px",
            border: "none",
            padding: 0,
            background: "transparent",
            cursor: "pointer",
          }}
        />

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: "12px",
            color: "#475569",
          }}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "12px",
          fontWeight: 700,
          color: "#334155",
          marginBottom: "7px",
        }}
      >
        {label}
      </label>

      <div
        style={{
          position: "relative",
        }}
      >
        {Icon && (
          <Icon
            size={12}
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94a3b8",
            }}
          />
        )}

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "1px solid #dbe3ea",
            borderRadius: "10px",
            padding: Icon
              ? "10px 11px 10px 32px"
              : "10px 11px",
            fontSize: "12px",
            color: "#334155",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

export default function Branding() {
  const [branding, setBranding] = useState(initialBranding);
  const [saved, setSaved] = useState(false);

  const updateField = (field, value) => {
    setBranding((current) => ({
      ...current,
      [field]: value,
    }));

    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
  };

  const handleReset = () => {
    setBranding(initialBranding);
    setSaved(false);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "24px",
        paddingBottom: "32px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "8px",
            }}
          >
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "12px",
                background: "#ecfdf5",
                color: "#0f766e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FaPalette />
            </div>

            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: "#0f766e",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Tenant Administration
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Organisation Branding
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              color: "#64748b",
            }}
          >
            Configure the identity, colours and presentation of
            your healthcare organisation.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "9px",
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid #dbe3ea",
              background: "#ffffff",
              color: "#475569",
              borderRadius: "11px",
              padding: "10px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <FaUndo />
            Reset
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: "none",
              background: branding.primaryColor,
              color: "#ffffff",
              borderRadius: "11px",
              padding: "10px 15px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <FaSave />
            Save Changes
          </button>
        </div>
      </div>

      {/* Saved notification */}
      {saved && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "13px 16px",
            background: "#ecfdf5",
            border: "1px solid #a7f3d0",
            borderRadius: "12px",
            color: "#166534",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          <FaCheckCircle />
          Branding changes have been saved successfully.
        </div>
      )}

      {/* Organisation information */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "11px",
              background: "#f0fdfa",
              color: "#0f766e",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FaBuilding size={15} />
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
                color: "#0f172a",
              }}
            >
              Organisation Information
            </h2>

            <p
              style={{
                margin: "4px 0 0",
                fontSize: "11px",
                color: "#94a3b8",
              }}
            >
              Information displayed throughout the healthcare
              platform.
            </p>
          </div>
        </div>

        <div
          style={{
            padding: "22px",
            display: "grid",
            gap: "18px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "16px",
            }}
          >
            <Field
              label="Organisation Name"
              value={branding.organisationName}
              onChange={(value) =>
                updateField("organisationName", value)
              }
            />

            <Field
              label="Facility / Clinic Name"
              value={branding.facilityName}
              onChange={(value) =>
                updateField("facilityName", value)
              }
            />

            <Field
              label="Registration Number"
              value={branding.registrationNumber}
              onChange={(value) =>
                updateField("registrationNumber", value)
              }
            />

            <Field
              label="Tagline"
              value={branding.tagline}
              onChange={(value) =>
                updateField("tagline", value)
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "16px",
            }}
          >
            <Field
              label="Email Address"
              value={branding.email}
              onChange={(value) =>
                updateField("email", value)
              }
              icon={FaEnvelope}
            />

            <Field
              label="Telephone"
              value={branding.phone}
              onChange={(value) =>
                updateField("phone", value)
              }
              icon={FaPhone}
            />

            <Field
              label="Website"
              value={branding.website}
              onChange={(value) =>
                updateField("website", value)
              }
              icon={FaGlobe}
            />

            <Field
              label="Address"
              value={branding.address}
              onChange={(value) =>
                updateField("address", value)
              }
              icon={FaMapMarkerAlt}
            />
          </div>
        </div>
      </section>

      {/* Logo */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 4px 14px rgba(15,23,42,0.04)",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "17px",
              color: "#0f172a",
            }}
          >
            Organisation Logo
          </h2>

          <p
            style={{
              margin: "5px 0 0",
              fontSize: "11px",
              color: "#94a3b8",
            }}
          >
            Upload the organisation logo used across the
            healthcare system.
          </p>
        </div>

        <div
          style={{
            padding: "22px",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "18px",
              border: "1px dashed #cbd5e1",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#0f766e",
              gap: "8px",
            }}
          >
            <FaBuilding size={35} />

            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
              }}
            >
              LOGO
            </span>
          </div>

          <div>
            <h3
              style={{
                margin: "0 0 6px",
                fontSize: "14px",
                color: "#334155",
              }}
            >
              Upload organisation logo
            </h3>

            <p
              style={{
                margin: "0 0 12px",
                fontSize: "11px",
                color: "#94a3b8",
                maxWidth: "420px",
              }}
            >
              Recommended size is 512 × 512 pixels. PNG,
              JPG and SVG formats are supported.
            </p>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#f0fdfa",
                border: "1px solid #99f6e4",
                color: "#0f766e",
                padding: "9px 13px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <FaUpload />

              Choose Logo

              <input
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Colours and preview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1fr) minmax(320px, 0.9fr)",
          gap: "20px",
        }}
      >
        {/* Colours */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow:
              "0 4px 14px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #e2e8f0",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "17px",
                color: "#0f172a",
              }}
            >
              Brand Colours
            </h2>

            <p
              style={{
                margin: "5px 0 0",
                fontSize: "11px",
                color: "#94a3b8",
              }}
            >
              Define the colours used throughout the
              organisation interface.
            </p>
          </div>

          <div
            style={{
              padding: "22px",
              display: "grid",
              gap: "17px",
            }}
          >
            <ColourField
              label="Primary Colour"
              value={branding.primaryColor}
              onChange={(value) =>
                updateField("primaryColor", value)
              }
            />

            <ColourField
              label="Secondary Colour"
              value={branding.secondaryColor}
              onChange={(value) =>
                updateField("secondaryColor", value)
              }
            />

            <ColourField
              label="Accent Colour"
              value={branding.accentColor}
              onChange={(value) =>
                updateField("accentColor", value)
              }
            />
          </div>
        </section>

        {/* Preview */}
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "20px",
            overflow: "hidden",
            boxShadow:
              "0 4px 14px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              padding: "20px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "17px",
                  color: "#0f172a",
                }}
              >
                Brand Preview
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: "11px",
                  color: "#94a3b8",
                }}
              >
                Preview how your organisation branding will
                appear.
              </p>
            </div>

            <FaEye color="#94a3b8" />
          </div>

          <div
            style={{
              padding: "22px",
            }}
          >
            <div
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "16px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background: branding.primaryColor,
                  padding: "18px",
                  color: "#ffffff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "10px",
                      background:
                        "rgba(255,255,255,0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FaBuilding />
                  </div>

                  <div>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "14px",
                      }}
                    >
                      {branding.organisationName}
                    </div>

                    <div
                      style={{
                        fontSize: "10px",
                        opacity: 0.8,
                      }}
                    >
                      Healthcare Management System
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  padding: "20px",
                  background: "#ffffff",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 800,
                    color: "#0f172a",
                    marginBottom: "5px",
                  }}
                >
                  {branding.facilityName}
                </div>

                <div
                  style={{
                    fontSize: "11px",
                    color: "#64748b",
                    marginBottom: "16px",
                  }}
                >
                  {branding.tagline}
                </div>

                <button
                  type="button"
                  style={{
                    border: "none",
                    background: branding.primaryColor,
                    color: "#ffffff",
                    borderRadius: "9px",
                    padding: "9px 14px",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  Access Healthcare Portal
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer information */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "14px 17px",
          borderRadius: "14px",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          fontSize: "11px",
          color: "#64748b",
        }}
      >
        <FaCheckCircle color="#0f766e" />

        Branding changes apply to the selected organisation and
        will eventually be propagated across its tenant
        applications.
      </div>
    </div>
  );
}