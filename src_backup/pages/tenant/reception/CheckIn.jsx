import PageHeader from "../../../components/common/PageHeader";

export default function CheckIn() {
  return (
    <div>
      <PageHeader
        title="Patient Check-In"
        subtitle="Check patients in and manage their arrival status."
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
            marginTop: 0,
            color: "#10233f",
          }}
        >
          Patient Check-In
        </h2>

        <p
          style={{
            color: "#64748b",
            marginBottom: "20px",
          }}
        >
          Search for a registered patient or process a walk-in patient.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "12px",
          }}
        >
          <input
            type="text"
            placeholder="Search patient by name, ID or MPI number..."
            style={{
              padding: "14px 16px",
              border: "1px solid #dbe3ea",
              borderRadius: "10px",
              fontSize: "14px",
              outline: "none",
            }}
          />

          <button
            type="button"
            style={{
              padding: "14px 22px",
              border: "none",
              borderRadius: "10px",
              background: "#0f8f95",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Search
          </button>
        </div>
      </div>
    </div>
  );
}