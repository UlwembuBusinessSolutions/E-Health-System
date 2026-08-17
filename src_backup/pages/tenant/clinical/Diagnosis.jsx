import PageHeader from "../../../components/common/PageHeader";

export default function Diagnosis() {
  return (
    <div>
      <PageHeader
        title="Diagnosis"
        subtitle="Record, review and manage patient diagnoses."
      />

      <div
        style={{
          marginTop: "24px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "24px",
        }}
      >
        <h2
          style={{
            margin: 0,
            color: "#10233f",
            fontSize: "20px",
          }}
        >
          Patient Diagnosis
        </h2>

        <p
          style={{
            marginTop: "8px",
            color: "#64748b",
          }}
        >
          Record and manage clinical diagnoses for the selected patient.
        </p>

        <div
          style={{
            marginTop: "24px",
            display: "grid",
            gap: "16px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              Patient
            </label>

            <input
              type="text"
              placeholder="Search patient..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                border: "1px solid #dbe3ea",
                borderRadius: "10px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              Diagnosis
            </label>

            <input
              type="text"
              placeholder="Enter diagnosis..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                border: "1px solid #dbe3ea",
                borderRadius: "10px",
                fontSize: "14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              Clinical Notes
            </label>

            <textarea
              rows="5"
              placeholder="Enter clinical notes..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "13px 14px",
                border: "1px solid #dbe3ea",
                borderRadius: "10px",
                fontSize: "14px",
                resize: "vertical",
              }}
            />
          </div>

          <div>
            <button
              type="button"
              style={{
                padding: "13px 20px",
                border: "none",
                borderRadius: "10px",
                background: "#0f8f95",
                color: "#ffffff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Save Diagnosis
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}