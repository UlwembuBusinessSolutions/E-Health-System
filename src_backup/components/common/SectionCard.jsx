export default function SectionCard({ title, subtitle, children }) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #dbe7e4",
        borderRadius: "20px",
        padding: "24px",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
      }}
    >
      {(title || subtitle) && (
        <div style={{ marginBottom: "18px" }}>
          {title && (
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {title}
            </h2>
          )}

          {subtitle && (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "14px",
                color: "#64748b",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {children}
    </section>
  );
}